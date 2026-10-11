#!/usr/bin/env node
// Idempotent setup for the self-hosted stack (docs/self-hosting.md):
// secrets, Docker services, .env.local, and the Convex cloud deployment's env.
// Safe to re-run: existing values are kept and conflicts are only reported.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  APP_GENERATED_KEYS,
  appEnvValues,
  composeEnvDefaults,
  composeUpArgs,
  convexEnvValues,
  mergeEnv,
  missingR2Settings,
  parseEnv,
} from "./selfhost-env.mjs";

const root = path.resolve(import.meta.dirname, "..");
const composeDir = path.join(root, "docker", "selfhost");
const composeEnvPath = path.join(composeDir, ".env");
const appEnvPath = path.join(root, ".env.local");
const HOSTS_PATH =
  process.platform === "win32"
    ? "C:\\Windows\\System32\\drivers\\etc\\hosts"
    : "/etc/hosts";
const HEADER = "# --- Self-hosted stack (pnpm selfhost:setup) ---";
const convexCli = path.join(root, "node_modules", "convex", "bin", "main.js");
const startServices = !process.argv.includes("--no-start");

const read = (file) =>
  fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";

// No shell: values such as the Convex admin key contain "|".
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(`${command} ${args.join(" ")} failed:\n${output}`);
  }
  return result.stdout ?? "";
}

const compose = (args, options) =>
  run(
    "docker",
    ["compose", "-f", path.join(composeDir, "compose.yml"), ...args],
    options,
  );

function writeEnv(file, values, options) {
  const before = read(file);
  const { text, conflicts } = mergeEnv(before, values, HEADER, options);
  if (text !== before) {
    if (before) fs.copyFileSync(file, `${file}.bak`);
    fs.writeFileSync(file, text, { mode: 0o600 });
  }
  return { env: parseEnv(text), conflicts };
}

function step(message) {
  console.log(`\n> ${message}`);
}

step("Secrets for docker/selfhost/.env");
const composeDefaults = composeEnvDefaults();
const { env: composeEnv } = writeEnv(composeEnvPath, composeDefaults, {
  generated: Object.keys(composeDefaults),
});

// Containers reach these by service name; host processes need the same names.
const hostsText = read(HOSTS_PATH);
const unmappedHosts = ["trigger-s2"].filter(
  (host) =>
    !new RegExp(`^\\s*127\\.0\\.0\\.1\\s+.*\\b${host}\\b`, "m").test(hostsText),
);
if (unmappedHosts.length > 0) {
  console.warn(
    `\n! Add to ${HOSTS_PATH} (as administrator), then re-run:\n` +
      unmappedHosts.map((host) => `  127.0.0.1 ${host}\n`).join("") +
      "  trigger-s2: Agent output streams from the Trigger.dev worker.",
  );
}

const r2Missing = missingR2Settings(composeEnv);
if (r2Missing.length > 0) {
  console.warn(
    `\n! Missing Cloudflare R2 credentials. Set these in ${composeEnvPath}, then re-run:\n` +
      r2Missing.map((key) => `  ${key}\n`).join("") +
      "See docs/self-hosting.md for guidance.",
  );
  if (startServices) process.exit(1);
}

if (!startServices) {
  console.log("\nSkipped starting services (--no-start).");
  process.exit(0);
}

step("Starting services (first run pulls images and can take a while)");
compose(composeUpArgs(), { stdio: "inherit" });

step("Writing .env.local");
const { env: appEnv, conflicts } = writeEnv(
  appEnvPath,
  appEnvValues(composeEnv),
  { generated: APP_GENERATED_KEYS },
);
for (const key of ["CONVEX_SELF_HOSTED_URL", "CONVEX_SELF_HOSTED_ADMIN_KEY"]) {
  if (appEnv.get(key)) {
    conflicts.push(
      `${key} (remove it: it points the CLI at a self-hosted Convex)`,
    );
  }
}

const convexDeployment = appEnv.get("CONVEX_DEPLOYMENT");
const convexUrl = appEnv.get("NEXT_PUBLIC_CONVEX_URL");
if (convexDeployment && convexUrl) {
  // The sandbox container reads the deployment URL from docker/selfhost/.env.
  const { conflicts: composeConflicts } = writeEnv(composeEnvPath, {
    CONVEX_URL: convexUrl,
  });
  if (composeConflicts.length) {
    conflicts.push(
      `CONVEX_URL in docker/selfhost/.env (set it to ${convexUrl})`,
    );
  }

  step(`Setting Convex environment variables (${convexDeployment})`);
  for (const [name, value] of Object.entries(convexEnvValues(appEnv))) {
    if (!value) {
      console.log(`  ${name} (skipped: empty in .env.local)`);
      continue;
    }
    run(process.execPath, [convexCli, "env", "set", name, value]);
    console.log(`  ${name}`);
  }
} else {
  console.warn(
    "\n! No Convex cloud deployment yet. Run `pnpm exec convex dev --once --configure`" +
      "\n  (log in, then create or choose a project on the free plan), then re-run this setup.",
  );
}

if (conflicts.length) {
  console.warn(
    `\n! Kept existing .env.local values that differ from the self-hosted defaults:\n  ${conflicts.join("\n  ")}`,
  );
}

const missing = [
  "WORKOS_CLIENT_ID",
  "WORKOS_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENAI_API_KEY",
  "TRIGGER_PROJECT_ID",
  "TRIGGER_SECRET_KEY",
].filter((key) => !appEnv.get(key));

console.log(`
Done. Sign in at http://localhost:3000 with your WorkOS account.
${missing.length ? `\nStill to fill in .env.local, then re-run this setup: ${missing.join(", ")}` : ""}
Next steps are in docs/self-hosting.md.`);
