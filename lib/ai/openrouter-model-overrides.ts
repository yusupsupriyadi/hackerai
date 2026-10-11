import { wrapLanguageModel, type LanguageModel } from "ai";

type LanguageModelV3 = Exclude<LanguageModel, string> & {
  specificationVersion: "v3";
};

/**
 * Self-hosted installs can point the OpenRouter client at a compatible gateway
 * (OPENROUTER_BASE_URL) that names models differently. OPENROUTER_MODEL_OVERRIDES
 * maps OpenRouter slugs to the gateway's ids as comma-separated `from=to`
 * entries; `*=to` covers every slug without its own entry.
 */
export function parseModelSlugOverrides(
  value: string | undefined,
): ((slug: string) => string) | undefined {
  const entries = (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) return undefined;

  const overrides = new Map<string, string>();
  for (const entry of entries) {
    const separator = entry.indexOf("=");
    const from = entry.slice(0, separator).trim();
    const to = entry.slice(separator + 1).trim();
    if (separator <= 0 || !from || !to) {
      throw new Error(
        `OPENROUTER_MODEL_OVERRIDES entry "${entry}" must look like from=to`,
      );
    }
    overrides.set(from, to);
  }

  const wildcard = overrides.get("*");
  return (slug) => overrides.get(slug) ?? wildcard ?? slug;
}

/**
 * Requests go out with the gateway's model id, while the app keeps seeing its
 * own slug, which drives pricing, model-specific behavior, and the check that
 * the response came from the requested route.
 */
export function withGatewayModelId(
  model: LanguageModelV3,
  slug: string,
): LanguageModelV3 {
  const gatewayModelId = model.modelId;
  if (gatewayModelId === slug) return model;

  const toSlug = (modelId: string | undefined) =>
    modelId === gatewayModelId ? slug : modelId;

  return wrapLanguageModel({
    model,
    modelId: slug,
    middleware: {
      specificationVersion: "v3",
      wrapGenerate: async ({ doGenerate }) => {
        const result = await doGenerate();
        return result.response
          ? {
              ...result,
              response: {
                ...result.response,
                modelId: toSlug(result.response.modelId),
              },
            }
          : result;
      },
      wrapStream: async ({ doStream }) => {
        const result = await doStream();
        return {
          ...result,
          stream: result.stream.pipeThrough(
            new TransformStream({
              transform(part, controller) {
                controller.enqueue(
                  part.type === "response-metadata"
                    ? { ...part, modelId: toSlug(part.modelId) }
                    : part,
                );
              },
            }),
          ),
        };
      },
    },
  }) as LanguageModelV3;
}
