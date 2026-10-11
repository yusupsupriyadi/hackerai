import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appEnvValues,
  buildR2Endpoint,
  composeEnvDefaults,
  composeUpArgs,
  convexEnvValues,
  mergeEnv,
  missingR2Settings,
  parseEnv,
} from "../selfhost-env.mjs";

const HEADER = "# --- self-host ---";

describe("parseEnv", () => {
  it("reads plain, quoted, exported, and commented values", () => {
    const env = parseEnv(
      "A=1\nexport B=\"two words\"\nC='x'\nD=value # note\n# E=skip\nF=\r\nA=override",
    );
    assert.deepEqual(Object.fromEntries(env), {
      A: "override",
      B: "two words",
      C: "x",
      D: "value",
      F: "",
    });
  });
});

describe("mergeEnv", () => {
  it("appends missing keys under a header and keeps user values", () => {
    const { text, conflicts } = mergeEnv(
      "FIRECRAWL_API_KEY=fc-user\nEMPTY=\n",
      { FIRECRAWL_API_KEY: "", EMPTY: "filled", NEW_KEY: "v" },
      HEADER,
    );
    assert.equal(
      text,
      `FIRECRAWL_API_KEY=fc-user\nEMPTY=filled\n\n${HEADER}\nNEW_KEY=v\n`,
    );
    assert.deepEqual(conflicts, []);
  });

  it("reports differing fixed values without overwriting them", () => {
    const { text, conflicts } = mergeEnv(
      "NEXT_PUBLIC_CONVEX_URL=https://old.convex.cloud\n",
      { NEXT_PUBLIC_CONVEX_URL: "http://127.0.0.1:3210" },
      HEADER,
    );
    assert.equal(text, "NEXT_PUBLIC_CONVEX_URL=https://old.convex.cloud\n");
    assert.deepEqual(conflicts, ["NEXT_PUBLIC_CONVEX_URL"]);
  });

  it("does not report regenerated secrets as conflicts", () => {
    const { conflicts } = mergeEnv(
      "SECRET=existing\n",
      { SECRET: "fresh" },
      HEADER,
      { generated: ["SECRET"] },
    );
    assert.deepEqual(conflicts, []);
  });

  it("is idempotent", () => {
    const values = { A: "1", B: "2" };
    const first = mergeEnv("", values, HEADER).text;
    assert.equal(mergeEnv(first, values, HEADER).text, first);
  });
});

describe("self-hosted value sets", () => {
  it("generates Trigger.dev secrets of exactly 32 characters", () => {
    const defaults = composeEnvDefaults();
    for (const [key, value] of Object.entries(defaults)) {
      if (key.startsWith("TRIGGER_")) assert.equal(value.length, 32, key);
    }
  });

  it("includes R2 defaults", () => {
    const defaults = composeEnvDefaults();
    assert.equal(defaults.R2_ACCOUNT_ID, "");
    assert.equal(defaults.R2_ACCESS_KEY_ID, "");
    assert.equal(defaults.R2_SECRET_ACCESS_KEY, "");
    assert.equal(defaults.R2_BUCKET_NAME, "hackerai-files");
  });

  it("builds R2 endpoint from account ID", () => {
    const compose = new Map([
      ["R2_ACCOUNT_ID", "123abc"],
      ["R2_ACCESS_KEY_ID", "key"],
      ["R2_SECRET_ACCESS_KEY", "secret"],
      ["R2_BUCKET_NAME", "hackerai-files"],
    ]);
    assert.equal(
      buildR2Endpoint(compose),
      "https://123abc.r2.cloudflarestorage.com",
    );
  });

  it("returns empty R2 endpoint when account ID is missing", () => {
    const compose = new Map([["R2_ACCOUNT_ID", ""]]);
    assert.equal(buildR2Endpoint(compose), "");
  });

  it("identifies missing R2 settings", () => {
    const compose = new Map(Object.entries(composeEnvDefaults()));
    const missing = missingR2Settings(compose);
    assert.deepEqual(missing, [
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
    ]);
  });

  it("reports no missing R2 settings when configured", () => {
    const compose = new Map([
      ["R2_ACCOUNT_ID", "123abc"],
      ["R2_ACCESS_KEY_ID", "key"],
      ["R2_SECRET_ACCESS_KEY", "secret"],
      ["R2_BUCKET_NAME", "hackerai-files"],
    ]);
    assert.deepEqual(missingR2Settings(compose), []);
  });

  it("points the app at host ports and Convex cloud at public services", () => {
    const compose = new Map(
      Object.entries({
        ...composeEnvDefaults(),
        R2_ACCOUNT_ID: "123abc",
        R2_ACCESS_KEY_ID: "key",
        R2_SECRET_ACCESS_KEY: "secret",
        R2_BUCKET_NAME: "hackerai-files",
      }),
    );
    const app = appEnvValues(compose);
    // `convex dev --configure` writes the deployment settings.
    assert.equal(app.CONVEX_DEPLOYMENT, undefined);
    assert.equal(app.NEXT_PUBLIC_CONVEX_URL, undefined);
    assert.equal(app.CONVEX_SELF_HOSTED_URL, undefined);
    assert.equal(
      app.AWS_S3_SECRET_ACCESS_KEY,
      compose.get("R2_SECRET_ACCESS_KEY"),
    );
    assert.equal(app.AWS_S3_REGION, "auto");
    assert.equal(
      app.AWS_S3_ENDPOINT,
      "https://123abc.r2.cloudflarestorage.com",
    );
    assert.equal(
      app.CENTRIFUGO_WS_URL,
      "ws://localhost:8000/connection/websocket",
    );

    const convex = convexEnvValues(
      new Map(
        Object.entries({
          ...app,
          WORKOS_CLIENT_ID: "client_staging",
          WORKOS_API_KEY: "sk_test_staging",
        }),
      ),
    );
    assert.equal(convex.WORKOS_CLIENT_ID, "client_staging");
    assert.equal(
      convex.AWS_S3_ENDPOINT,
      "https://123abc.r2.cloudflarestorage.com",
    );
    assert.equal(
      convex.CENTRIFUGO_WS_URL,
      "ws://centrifugo:8000/connection/websocket",
    );
    assert.equal(convex.CONVEX_SERVICE_ROLE_KEY, app.CONVEX_SERVICE_ROLE_KEY);
    assert.equal(convex.NEXT_PUBLIC_SELF_HOSTED_ENTITLEMENTS, "ultra-plan");
    // Convex cloud cannot reach the local Redis.
    assert.equal(convex.REDIS_URL, undefined);
    for (const [key, value] of Object.entries(convex)) {
      assert.ok(value, `${key} must be set`);
    }
  });
});

describe("WorkOS cloud sign-in", () => {
  it("leaves WorkOS credentials to the user and points Convex at WorkOS", () => {
    const app = appEnvValues(new Map(Object.entries(composeEnvDefaults())));
    assert.equal(app.WORKOS_CLIENT_ID, "");
    assert.equal(app.WORKOS_API_KEY, "");
    assert.equal(app.NEXT_PUBLIC_SELF_HOSTED_ENTITLEMENTS, "ultra-plan");

    // Convex rejects leaving unset what convex/auth.config.ts reads.
    const convex = convexEnvValues(new Map(Object.entries(app)));
    assert.equal(convex.WORKOS_AUTH_DOMAIN, "https://api.workos.com");
  });

  it("adds the sandbox profile only when asked", () => {
    assert.deepEqual(composeUpArgs(), ["up", "-d", "--build", "--wait"]);
    assert.deepEqual(composeUpArgs({ sandbox: true }), [
      "--profile",
      "sandbox",
      "up",
      "-d",
      "--build",
      "--wait",
    ]);
  });
});
