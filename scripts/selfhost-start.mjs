// Starts the Docker services (the sandbox too once its token is set), then the
// host processes: Next.js, Convex functions, and the Trigger.dev worker.
// --no-dev starts only the Docker services.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { composeUpArgs, parseEnv } from "./selfhost-env.mjs";

const root = path.resolve(import.meta.dirname, "..");
const composeDir = path.join(root, "docker", "selfhost");
const composeEnvPath = path.join(composeDir, ".env");
const appEnvPath = path.join(root, ".env.local");
const startDev = !process.argv.includes("--no-dev");

if (!fs.existsSync(composeEnvPath)) {
  console.error(
    "docker/selfhost/.env is missing. Run the first-time setup: pnpm selfhost:setup",
  );
  process.exit(1);
}

const composeEnv = parseEnv(fs.readFileSync(composeEnvPath, "utf8"));
const appEnv = parseEnv(
  fs.existsSync(appEnvPath) ? fs.readFileSync(appEnvPath, "utf8") : "",
);

const missing = [
  "CONVEX_DEPLOYMENT",
  "NEXT_PUBLIC_CONVEX_URL",
  "WORKOS_CLIENT_ID",
  "WORKOS_API_KEY",
].filter((key) => !appEnv.get(key));
if (missing.length) {
  console.error(
    `.env.local is missing ${missing.join(", ")}.\n` +
      "Follow the first-time setup in docs/self-hosting.md, then pnpm selfhost:setup.",
  );
  process.exit(1);
}

const hasSandboxToken = Boolean(composeEnv.get("HACKERAI_LOCAL_TOKEN"));

const up = spawnSync(
  "docker",
  [
    "compose",
    "-f",
    path.join(composeDir, "compose.yml"),
    ...composeUpArgs({ sandbox: hasSandboxToken }),
  ],
  { cwd: root, stdio: "inherit" },
);
if (up.error) throw up.error;
if (up.status !== 0) process.exit(up.status ?? 1);

if (!hasSandboxToken) {
  console.warn(
    "\n! Sandbox not started: HACKERAI_LOCAL_TOKEN is empty in docker/selfhost/.env.\n" +
      "  Agent mode needs it; see docs/self-hosting.md (Sandbox for Agent mode).\n",
  );
}

if (startDev) {
  // Ctrl+C reaches both processes; wait for the dev processes to shut down.
  process.on("SIGINT", () => {});
  // pnpm is a .cmd shim on Windows, which spawn only runs through a shell.
  const dev = spawn("pnpm", ["dev:selfhost"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  dev.on("exit", (code) => process.exit(code ?? 0));
}
