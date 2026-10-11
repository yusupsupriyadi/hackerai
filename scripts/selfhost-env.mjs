// Env-file helpers and the self-hosted value set used by selfhost-setup.mjs.
import crypto from "node:crypto";

const hex = (bytes) => crypto.randomBytes(bytes).toString("hex");

const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

const unquote = (raw) => {
  const value = raw.trim();
  const quoted = value.match(/^(['"])(.*)\1$/);
  if (quoted) return quoted[2];
  return value.replace(/\s+#.*$/, "");
};

/** Parse KEY=VALUE lines; later duplicates win, like dotenv. */
export function parseEnv(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(LINE);
    if (match) values.set(match[1], unquote(match[2]));
  }
  return values;
}

/**
 * Add missing keys and fill empty ones without touching values the user set.
 * Returns the new text plus the keys whose existing value differs from the
 * suggested one, so the caller can warn instead of silently overwriting.
 * Freshly generated secrets never count as conflicts.
 */
export function mergeEnv(text, values, header, { generated = [] } = {}) {
  const generatedKeys = new Set(generated);
  const current = parseEnv(text);
  const lines = text.length ? text.replace(/\r\n/g, "\n").split("\n") : [];
  const appended = [];
  const conflicts = [];

  for (const [key, value] of Object.entries(values)) {
    if (!current.has(key)) {
      appended.push(`${key}=${value}`);
      continue;
    }
    const existing = current.get(key);
    if (existing === "" && value !== "") {
      const index = lines.findLastIndex(
        (line) => line.match(LINE)?.[1] === key,
      );
      lines[index] = `${key}=${value}`;
    } else if (
      existing !== "" &&
      value !== "" &&
      existing !== value &&
      !generatedKeys.has(key)
    ) {
      conflicts.push(key);
    }
  }

  while (lines.length && lines.at(-1) === "") lines.pop();
  if (appended.length) {
    if (lines.length) lines.push("");
    lines.push(header, ...appended);
  }
  return { text: `${lines.join("\n")}\n`, conflicts };
}

/** Secrets for docker/selfhost/.env. Existing values always win in mergeEnv. */
export function composeEnvDefaults() {
  return {
    R2_ACCOUNT_ID: "",
    R2_ACCESS_KEY_ID: "",
    R2_SECRET_ACCESS_KEY: "",
    R2_BUCKET_NAME: "hackerai-files",
    CENTRIFUGO_TOKEN_SECRET: hex(32),
    CENTRIFUGO_API_KEY: hex(32),
    // Trigger.dev requires exactly 32-character secrets (openssl rand -hex 16).
    TRIGGER_SESSION_SECRET: hex(16),
    TRIGGER_MAGIC_LINK_SECRET: hex(16),
    TRIGGER_ENCRYPTION_KEY: hex(16),
    TRIGGER_PROVIDER_SECRET: hex(16),
    TRIGGER_COORDINATOR_SECRET: hex(16),
    TRIGGER_MANAGED_WORKER_SECRET: hex(16),
    TRIGGER_POSTGRES_PASSWORD: hex(16),
    TRIGGER_CLICKHOUSE_PASSWORD: hex(16),
    HACKERAI_LOCAL_TOKEN: "",
  };
}

export const buildR2Endpoint = (compose) => {
  const accountId = compose.get("R2_ACCOUNT_ID")?.trim();
  return accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "";
};

const R2_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
];

export const missingR2Settings = (compose) =>
  R2_KEYS.filter((key) => !compose.get(key)?.trim());

/** `docker compose up` arguments, with the sandbox once its token is set. */
export function composeUpArgs({ sandbox = false } = {}) {
  return [
    ...(sandbox ? ["--profile", "sandbox"] : []),
    "up",
    "-d",
    "--build",
    "--wait",
  ];
}

/** Keys of appEnvValues that hold freshly generated secrets. */
export const APP_GENERATED_KEYS = [
  "WORKOS_COOKIE_PASSWORD",
  "ACCOUNT_IDENTITY_HMAC_SECRET",
  "CONVEX_SERVICE_ROLE_KEY",
  "CONVEX_USER_RESEARCH_SERVICE_KEY",
];

/** App settings for .env.local (Next.js and the Trigger.dev dev worker). */
export function appEnvValues(compose) {
  return {
    NEXT_PUBLIC_SELF_HOSTED: "true",
    // No billing backs a self-hosted account, so it gets the top tier.
    NEXT_PUBLIC_SELF_HOSTED_ENTITLEMENTS: "ultra-plan",
    NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
    NEXT_PUBLIC_WORKOS_REDIRECT_URI: "http://localhost:3000/callback",
    // From a non-production WorkOS environment; see docs/self-hosting.md.
    WORKOS_CLIENT_ID: "",
    WORKOS_API_KEY: "",
    WORKOS_COOKIE_PASSWORD: hex(32),
    ACCOUNT_IDENTITY_HMAC_SECRET: crypto.randomBytes(32).toString("base64"),
    // CONVEX_DEPLOYMENT and NEXT_PUBLIC_CONVEX_URL come from `convex dev --configure`.
    CONVEX_SERVICE_ROLE_KEY: hex(32),
    CONVEX_USER_RESEARCH_SERVICE_KEY: hex(32),
    AWS_S3_ACCESS_KEY_ID: compose.get("R2_ACCESS_KEY_ID"),
    AWS_S3_SECRET_ACCESS_KEY: compose.get("R2_SECRET_ACCESS_KEY"),
    AWS_S3_REGION: "auto",
    AWS_S3_BUCKET_NAME: compose.get("R2_BUCKET_NAME"),
    AWS_S3_ENDPOINT: buildR2Endpoint(compose),
    INLINE_FILE_URLS_FOR_MODELS: "true",
    REDIS_URL: "redis://127.0.0.1:6379",
    CENTRIFUGO_TOKEN_SECRET: compose.get("CENTRIFUGO_TOKEN_SECRET"),
    CENTRIFUGO_WS_URL: "ws://localhost:8000/connection/websocket",
    TRIGGER_API_URL: "http://localhost:8030",
    NEXT_PUBLIC_TRIGGER_API_URL: "http://localhost:8030",
    TRIGGER_PROJECT_ID: "",
    TRIGGER_SECRET_KEY: "",
    OPENROUTER_API_KEY: "",
    // Optional OpenRouter-compatible gateway; see docs/self-hosting.md.
    OPENROUTER_BASE_URL: "",
    OPENROUTER_MODEL_OVERRIDES: "",
    OPENAI_API_KEY: "",
    FIRECRAWL_API_KEY: "",
    // Optional cloud (E2B) sandbox; needs the terminal-agent-sandbox template
    // built into the account (pnpm run e2b:build:prod). See docs/self-hosting.md.
    E2B_API_KEY: "",
  };
}

/** Convex cloud deployment env; it can only reach public services. */
export function convexEnvValues(app) {
  return {
    WORKOS_CLIENT_ID: app.get("WORKOS_CLIENT_ID"),
    WORKOS_API_KEY: app.get("WORKOS_API_KEY"),
    // convex/auth.config.ts reads it, and Convex rejects leaving it unset.
    WORKOS_AUTH_DOMAIN: "https://api.workos.com",
    NEXT_PUBLIC_SELF_HOSTED_ENTITLEMENTS: app.get(
      "NEXT_PUBLIC_SELF_HOSTED_ENTITLEMENTS",
    ),
    CONVEX_SERVICE_ROLE_KEY: app.get("CONVEX_SERVICE_ROLE_KEY"),
    CONVEX_USER_RESEARCH_SERVICE_KEY: app.get(
      "CONVEX_USER_RESEARCH_SERVICE_KEY",
    ),
    AWS_S3_ACCESS_KEY_ID: app.get("AWS_S3_ACCESS_KEY_ID"),
    AWS_S3_SECRET_ACCESS_KEY: app.get("AWS_S3_SECRET_ACCESS_KEY"),
    AWS_S3_REGION: app.get("AWS_S3_REGION"),
    AWS_S3_BUCKET_NAME: app.get("AWS_S3_BUCKET_NAME"),
    AWS_S3_ENDPOINT: app.get("AWS_S3_ENDPOINT"),
    CENTRIFUGO_TOKEN_SECRET: app.get("CENTRIFUGO_TOKEN_SECRET"),
    // Handed to the sandbox container, which reaches Centrifugo by service name.
    CENTRIFUGO_WS_URL: "ws://centrifugo:8000/connection/websocket",
    // No REDIS_URL: Convex cloud cannot reach the local Redis, so stream
    // cancellation falls back to polling (convex/redisPubsub.ts).
  };
}
