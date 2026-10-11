import { streamText } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { WritableStream } from "node:stream/web";
import {
  parseModelSlugOverrides,
  withGatewayModelId,
} from "@/lib/ai/openrouter-model-overrides";

const originalWritableStream = globalThis.WritableStream;
beforeAll(() => {
  Object.defineProperty(globalThis, "WritableStream", {
    configurable: true,
    value: WritableStream,
  });
});
afterAll(() => {
  Object.defineProperty(globalThis, "WritableStream", {
    configurable: true,
    value: originalWritableStream,
  });
});

describe("parseModelSlugOverrides", () => {
  it("returns undefined when no overrides are configured", () => {
    expect(parseModelSlugOverrides(undefined)).toBeUndefined();
    expect(parseModelSlugOverrides("  ")).toBeUndefined();
  });

  it("maps listed slugs and sends the rest to the wildcard", () => {
    const toGatewayId = parseModelSlugOverrides(
      " deepseek/deepseek-v4.1-flash = cb/deepseek-v4.1-flash ," +
        "z-ai/glm-5.3-flash=cbcn/glm-5.3-flash,*=cb/deepseek-v4.1-flash",
    )!;

    expect(toGatewayId("deepseek/deepseek-v4.1-flash")).toBe(
      "cb/deepseek-v4.1-flash",
    );
    expect(toGatewayId("z-ai/glm-5.3-flash")).toBe("cbcn/glm-5.3-flash");
    expect(toGatewayId("x-ai/grok-4.6")).toBe("cb/deepseek-v4.1-flash");
  });

  it("keeps unlisted slugs without a wildcard", () => {
    const toGatewayId = parseModelSlugOverrides("a/b=c/d")!;
    expect(toGatewayId("x-ai/grok-4.6")).toBe("x-ai/grok-4.6");
  });

  it("rejects malformed entries instead of ignoring them", () => {
    expect(() => parseModelSlugOverrides("a/b=c/d,cb/model")).toThrow(
      /OPENROUTER_MODEL_OVERRIDES entry "cb\/model"/,
    );
    expect(() => parseModelSlugOverrides("a/b=")).toThrow(
      /OPENROUTER_MODEL_OVERRIDES entry "a\/b="/,
    );
  });
});

const usage = {
  inputTokens: {
    total: 3,
    noCache: 3,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 2, text: 2, reasoning: undefined },
};

describe("withGatewayModelId", () => {
  const gatewayModel = () =>
    new MockLanguageModelV3({
      modelId: "cb/deepseek-v4.1-flash",
      doGenerate: async () => ({
        content: [{ type: "text", text: "PONG" }],
        finishReason: { unified: "stop", raw: "stop" },
        usage,
        warnings: [],
        response: { modelId: "cb/deepseek-v4.1-flash" },
      }),
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({
              type: "response-metadata",
              id: "chatcmpl-1",
              modelId: "cb/deepseek-v4.1-flash",
            });
            controller.enqueue({ type: "text-start", id: "t" });
            controller.enqueue({ type: "text-delta", id: "t", delta: "PONG" });
            controller.enqueue({ type: "text-end", id: "t" });
            controller.enqueue({
              type: "finish",
              finishReason: { unified: "stop", raw: "stop" },
              usage,
            });
            controller.close();
          },
        }),
      }),
    });

  it("reports the app's slug while the gateway serves its own model id", async () => {
    const model = withGatewayModelId(
      gatewayModel(),
      "deepseek/deepseek-v4.1-flash",
    );
    expect(model.modelId).toBe("deepseek/deepseek-v4.1-flash");

    const streamed = streamText({ model, prompt: "ping" });
    expect(await streamed.text).toBe("PONG");
    expect((await streamed.response).modelId).toBe(
      "deepseek/deepseek-v4.1-flash",
    );

    const generated = await model.doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: "ping" }] }],
    });
    expect(generated.response?.modelId).toBe("deepseek/deepseek-v4.1-flash");
  });

  it("returns the model unchanged when the ids already match", () => {
    const model = gatewayModel();
    expect(withGatewayModelId(model, "cb/deepseek-v4.1-flash")).toBe(model);
  });
});
