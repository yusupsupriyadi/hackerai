import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { ToolContext } from "@/types";
import {
  createFirecrawlOpenUrlTool,
  createFirecrawlWebSearch,
  getFirecrawlConfig,
} from "../firecrawl";

const originalFetch = global.fetch;

const jsonResponse = (body: unknown, status = 200, statusText = "") =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: { get: () => "application/json" },
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

const run = (tool: unknown, input: Record<string, unknown>) =>
  (tool as { execute: (i: unknown, o: unknown) => Promise<unknown> }).execute(
    input,
    { toolCallId: "call-1", abortSignal: undefined, messages: [] },
  );

const makeContext = (onToolFailure = jest.fn()) =>
  ({ onToolFailure }) as unknown as ToolContext;

describe("getFirecrawlConfig", () => {
  afterEach(() => {
    delete process.env.FIRECRAWL_API_KEY;
    delete process.env.FIRECRAWL_API_URL;
  });

  it("is disabled without a key or URL", () => {
    expect(getFirecrawlConfig()).toBeNull();
  });

  it("uses Firecrawl cloud when only a key is set", () => {
    process.env.FIRECRAWL_API_KEY = "fc-test";
    expect(getFirecrawlConfig()).toEqual({
      apiUrl: "https://api.firecrawl.dev",
      apiKey: "fc-test",
    });
  });

  it("supports a self-hosted instance without a key", () => {
    process.env.FIRECRAWL_API_URL = "http://localhost:3002/";
    expect(getFirecrawlConfig()).toEqual({
      apiUrl: "http://localhost:3002",
      apiKey: undefined,
    });
  });
});

describe("Firecrawl tools", () => {
  const config = { apiUrl: "https://api.firecrawl.dev", apiKey: "fc-test" };
  let fetchMock: jest.Mock<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.fn<typeof fetch>();
    global.fetch = fetchMock;
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("searches each query with the recency filter and merges results", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            web: [
              { url: "https://a.test", title: "A", description: "about a" },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: [{ url: "https://b.test", title: "B", description: "about b" }],
        }),
      );

    const result = await run(createFirecrawlWebSearch(makeContext(), config), {
      queries: ["cve one", " cve two "],
      time: "past_week",
    });

    expect(result).toEqual([
      {
        title: "A",
        url: "https://a.test",
        content: "about a",
        date: null,
        lastUpdated: null,
      },
      {
        title: "B",
        url: "https://b.test",
        content: "about b",
        date: null,
        lastUpdated: null,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://api.firecrawl.dev/v2/search");
    expect(JSON.parse(String(init?.body))).toEqual({
      query: "cve two",
      limit: 10,
      tbs: "qdr:w",
    });
    expect(init?.headers).toMatchObject({ Authorization: "Bearer fc-test" });
  });

  it("omits the Authorization header for a keyless self-hosted instance", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { web: [] } }));

    await run(
      createFirecrawlWebSearch(makeContext(), {
        apiUrl: "http://localhost:3002",
      }),
      { queries: ["q"] },
    );

    expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty(
      "Authorization",
    );
  });

  it("rejects empty queries without calling Firecrawl", async () => {
    const result = await run(createFirecrawlWebSearch(makeContext(), config), {
      queries: ["  "],
    });

    expect(result).toBe(
      "Error performing web search: Provide at least one non-empty query.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports an unauthorized key as an actionable tool error", async () => {
    const onToolFailure = jest.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "Unauthorized" }, 401, "Unauthorized"),
    );

    const result = await run(
      createFirecrawlWebSearch(makeContext(onToolFailure), config),
      { queries: ["q"] },
    );

    expect(result).toBe(
      "Error performing web search: Firecrawl is not authorized (HTTP 401 Unauthorized). Check the Firecrawl API key.",
    );
    expect(onToolFailure).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "firecrawl", status: 401 }),
    );
  });

  it("opens a URL as main-content markdown", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { markdown: "# Title\n\nBody" } }),
    );

    const result = await run(
      createFirecrawlOpenUrlTool(makeContext(), config),
      {
        url: "https://example.test/page",
      },
    );

    expect(result).toBe("# Title\n\nBody");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.firecrawl.dev/v2/scrape");
    expect(JSON.parse(String(init?.body))).toEqual({
      url: "https://example.test/page",
      formats: ["markdown"],
      onlyMainContent: true,
      timeout: 30000,
    });
  });

  it("returns a tool error when scraping runs out of credits", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "Payment required" }, 402, "Payment Required"),
    );

    const result = await run(
      createFirecrawlOpenUrlTool(makeContext(), config),
      {
        url: "https://example.test/page",
      },
    );

    expect(result).toBe(
      "Error opening URL: Firecrawl is out of credits or rate limited (HTTP 402 Payment Required). Continue without live web results if the task can proceed.",
    );
  });
});
