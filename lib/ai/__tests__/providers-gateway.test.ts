const edgeFetchPrimitives =
  require("next/dist/compiled/@edge-runtime/primitives/fetch") as {
    Headers: typeof Headers;
    Response: typeof Response;
  };

const ENV_KEYS = [
  "OPENROUTER_API_KEY",
  "OPENROUTER_BASE_URL",
  "OPENROUTER_MODEL_OVERRIDES",
] as const;
const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);
const originalGlobals = {
  fetch: globalThis.fetch,
  Headers: globalThis.Headers,
  Response: globalThis.Response,
};

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  Object.assign(globalThis, originalGlobals);
});

it("sends gateway model ids to OPENROUTER_BASE_URL while the app keeps its slugs", async () => {
  const requests: Array<{ url: string; model: unknown }> = [];
  Object.assign(globalThis, {
    Headers: edgeFetchPrimitives.Headers,
    Response: edgeFetchPrimitives.Response,
    fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        url: String(url),
        model: JSON.parse(String(init?.body)).model,
      });
      return new edgeFetchPrimitives.Response(
        JSON.stringify({
          id: "chatcmpl-1",
          model: "cb/deepseek-v4.1-flash",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "PONG" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { headers: { "content-type": "application/json" } },
      );
    },
  });
  process.env.OPENROUTER_API_KEY = "gateway-key";
  process.env.OPENROUTER_BASE_URL = "https://gateway.example/v1";
  process.env.OPENROUTER_MODEL_OVERRIDES =
    "z-ai/glm-5.3-flash=cbcn/glm-5.3-flash,*=cb/deepseek-v4.1-flash";

  let providers!: typeof import("@/lib/ai/providers");
  jest.isolateModules(() => {
    providers = require("@/lib/ai/providers");
  });

  const askModel = providers.myProvider.languageModel("ask-model") as {
    modelId: string;
    doGenerate: (options: unknown) => Promise<{
      response?: { modelId?: string };
    }>;
  };
  expect(askModel.modelId).toBe("x-ai/grok-4.6");
  expect(
    (
      providers.myProvider.languageModel("title-generator-model") as {
        modelId: string;
      }
    ).modelId,
  ).toBe("z-ai/glm-5.3-flash");

  const result = await askModel.doGenerate({
    prompt: [{ role: "user", content: [{ type: "text", text: "ping" }] }],
  });

  expect(requests).toEqual([
    {
      url: "https://gateway.example/v1/chat/completions",
      model: "cb/deepseek-v4.1-flash",
    },
  ]);
  expect(result.response?.modelId).toBe("x-ai/grok-4.6");
});
