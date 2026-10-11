import { tool } from "ai";
import { truncateContent } from "@/lib/token-utils";
import { stringifyRedactedError } from "@/lib/utils/error-redaction";
import type { ToolContext } from "@/types";
import { reportToolFailure } from "./tool-failure";
import {
  PERPLEXITY_QUERY_MAX_LENGTH,
  createOpenUrlToolSchema,
  createWebSearchToolSchema,
  openUrlTool,
  webSearchTool,
  type OpenUrlToolInput,
  type WebSearchToolInput,
} from "./schemas";
import {
  summarizePerplexityErrorBody,
  type FormattedSearchResult,
} from "./utils/perplexity";

/**
 * Firecrawl adapters for web_search and open_url. They serve deployments
 * without Perplexity or Jina keys: Firecrawl cloud with FIRECRAWL_API_KEY, or a
 * self-hosted instance with FIRECRAWL_API_URL (which may not need a key).
 */
const FIRECRAWL_CLOUD_API_URL = "https://api.firecrawl.dev";
const SEARCH_RESULTS_PER_QUERY = 10;
const SCRAPE_TIMEOUT_MS = 30_000;

const TIME_TO_TBS: Record<string, string> = {
  past_day: "qdr:d",
  past_week: "qdr:w",
  past_month: "qdr:m",
  past_year: "qdr:y",
};

type FirecrawlConfig = { apiUrl: string; apiKey?: string };

export const getFirecrawlConfig = (): FirecrawlConfig | null => {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim() || undefined;
  const apiUrl = process.env.FIRECRAWL_API_URL?.trim();
  if (!apiKey && !apiUrl) return null;
  return {
    apiUrl: (apiUrl || FIRECRAWL_CLOUD_API_URL).replace(/\/+$/, ""),
    apiKey,
  };
};

class FirecrawlApiError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly bodySummary: string,
  ) {
    super(
      `Firecrawl API error ${status}${bodySummary ? `: ${bodySummary}` : ""}`,
    );
    this.name = "FirecrawlApiError";
  }
}

const postFirecrawl = async <T>(
  config: FirecrawlConfig,
  path: string,
  body: Record<string, unknown>,
  abortSignal?: AbortSignal,
): Promise<T> => {
  const response = await fetch(`${config.apiUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey && { Authorization: `Bearer ${config.apiKey}` }),
    },
    body: JSON.stringify(body),
    signal: abortSignal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new FirecrawlApiError(
      response.status,
      response.statusText,
      summarizePerplexityErrorBody(
        text,
        response.headers.get("content-type") || "",
      ),
    );
  }

  return (await response.json()) as T;
};

type FirecrawlSearchResult = {
  url?: string;
  title?: string;
  description?: string;
};

type FirecrawlSearchResponse = {
  data?: FirecrawlSearchResult[] | { web?: FirecrawlSearchResult[] };
};

const toFormattedResults = (
  response: FirecrawlSearchResponse,
): FormattedSearchResult[] => {
  const results = Array.isArray(response.data)
    ? response.data
    : (response.data?.web ?? []);
  return results
    .filter((result) => typeof result.url === "string")
    .map((result) => ({
      title: result.title ?? "",
      url: result.url!,
      content: result.description ?? "",
      date: null,
      lastUpdated: null,
    }));
};

const describeFailure = (error: FirecrawlApiError) => {
  const statusText = error.statusText ? ` ${error.statusText}` : "";
  if (error.status === 401 || error.status === 403) {
    return `Firecrawl is not authorized (HTTP ${error.status}${statusText}). Check the Firecrawl API key.`;
  }
  if (error.status === 402 || error.status === 429) {
    return `Firecrawl is out of credits or rate limited (HTTP ${error.status}${statusText}). Continue without live web results if the task can proceed.`;
  }
  return `Firecrawl request failed (HTTP ${error.status}${statusText}).`;
};

const isAbort = (error: unknown, abortSignal?: AbortSignal) =>
  abortSignal?.aborted ||
  (error instanceof Error && error.name === "AbortError");

export const createFirecrawlWebSearch = (
  context: ToolContext,
  config: FirecrawlConfig,
) =>
  tool({
    ...webSearchTool,
    inputSchema: createWebSearchToolSchema({
      modelName: context.getCurrentModelName?.() ?? context.modelName,
    }).inputSchema,
    execute: async ({ queries, time }: WebSearchToolInput, { abortSignal }) => {
      const normalized = queries.map((query) => query.trim()).filter(Boolean);
      if (normalized.length === 0) {
        return "Error performing web search: Provide at least one non-empty query.";
      }
      if (
        normalized.some((query) => query.length > PERPLEXITY_QUERY_MAX_LENGTH)
      ) {
        return `Error performing web search: Each query must be ${PERPLEXITY_QUERY_MAX_LENGTH} characters or fewer.`;
      }

      const tbs = time ? TIME_TO_TBS[time] : undefined;
      try {
        const responses = await Promise.all(
          normalized.slice(0, 3).map((query) =>
            postFirecrawl<FirecrawlSearchResponse>(
              config,
              "/v2/search",
              {
                query,
                limit: SEARCH_RESULTS_PER_QUERY,
                ...(tbs && { tbs }),
              },
              abortSignal,
            ),
          ),
        );
        return responses.flatMap(toFormattedResults);
      } catch (error) {
        if (isAbort(error, abortSignal)) return "Error: Operation aborted";

        const errorMessage = stringifyRedactedError(error);
        reportToolFailure(context.onToolFailure, {
          event: "web_search_provider_failed",
          tool_name: "web_search",
          provider: "firecrawl",
          ...(error instanceof FirecrawlApiError && {
            status: error.status,
            status_text: error.statusText,
            body_summary: error.bodySummary,
          }),
          error_name: error instanceof Error ? error.name : "UnknownError",
          error_message: errorMessage,
        });
        console.error("Web search tool error:", errorMessage);
        return error instanceof FirecrawlApiError
          ? `Error performing web search: ${describeFailure(error)}`
          : `Error performing web search: ${errorMessage}`;
      }
    },
  });

type FirecrawlScrapeResponse = {
  data?: { markdown?: string };
};

export const createFirecrawlOpenUrlTool = (
  context: ToolContext,
  config: FirecrawlConfig,
) =>
  tool({
    ...openUrlTool,
    inputSchema: createOpenUrlToolSchema({
      modelName: context.getCurrentModelName?.() ?? context.modelName,
    }).inputSchema,
    execute: async ({ url }: OpenUrlToolInput, { abortSignal }) => {
      try {
        const response = await postFirecrawl<FirecrawlScrapeResponse>(
          config,
          "/v2/scrape",
          {
            url,
            formats: ["markdown"],
            onlyMainContent: true,
            timeout: SCRAPE_TIMEOUT_MS,
          },
          abortSignal,
        );
        return truncateContent(response.data?.markdown ?? "", undefined, 2048);
      } catch (error) {
        if (isAbort(error, abortSignal)) return "Error: Operation aborted";

        const errorMessage = stringifyRedactedError(error);
        reportToolFailure(context.onToolFailure, {
          event: "open_url_provider_failed",
          tool_name: "open_url",
          provider: "firecrawl",
          ...(error instanceof FirecrawlApiError && {
            status: error.status,
            status_text: error.statusText,
          }),
          error_name: error instanceof Error ? error.name : "UnknownError",
          error_message: errorMessage,
        });
        console.error("Open URL tool error:", errorMessage);
        return error instanceof FirecrawlApiError
          ? `Error opening URL: ${describeFailure(error)}`
          : `Error opening URL: ${errorMessage}`;
      }
    },
  });
