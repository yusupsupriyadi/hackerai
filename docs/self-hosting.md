# Self-hosting on one machine

This runs HackerAI for one person on one computer. The app, the Agent runtime
(Trigger.dev), and the command sandbox run locally. Managed services cover the
rest: WorkOS for sign-in, Convex for the database and backend functions (the
free plan is enough), Cloudflare R2 for file storage, the AI model providers
(OpenRouter or a compatible gateway, OpenAI), and, optionally, Firecrawl for
web search. Design rationale: `docs/superpowers/specs/2026-10-11-local-self-hosting-design.md`.

## What runs where

The Next.js app, `convex dev` (it pushes the functions to your Convex cloud
deployment), and the Trigger.dev dev worker run on the host
(`pnpm dev:selfhost`). Everything else that runs locally is in Docker
(`docker/selfhost/compose.yml`). Every port binds to `127.0.0.1` only.

| Service      | Replaces                                  | Port          |
| ------------ | ----------------------------------------- | ------------- |
| `redis`      | Stream resumption                         | 6379          |
| `centrifugo` | Sandbox relay                             | 8000          |
| `trigger-*`  | Trigger.dev cloud                         | 8030, S2 9330 |
| `sandbox`    | E2B (Kali image running `packages/local`) | none          |

Uploaded files and Trigger.dev payloads are stored in Cloudflare R2, in your
own account (see [Cloudflare R2](#cloudflare-r2-one-time)). The browser,
Convex, the Trigger.dev worker, and the sandbox reach them through presigned
URLs: signed, time-limited links to private buckets.

Convex cloud can only reach public services, so it never calls the local
Redis: stream cancellation falls back to polling (`convex/redisPubsub.ts`).
It hands `CENTRIFUGO_WS_URL` to the sandbox container, which reaches
Centrifugo by service name.

Not used: E2B, Upstash (no usage limits outside production), PostHog, Stripe,
Intercom, Vercel crons. To sell plans, see [Polar billing](polar-billing.md).

## Requirements

- Docker Desktop, Node.js 22+, pnpm (via corepack).
- Enough free RAM for the Trigger.dev containers (ClickHouse, Postgres,
  Redis, Electric, the webapp) and the sandbox; `docker stats` shows actual
  use.
- Accounts: WorkOS, Convex (free plan), and Cloudflare with R2 enabled.
  Enabling R2 asks for a payment method; Cloudflare's R2 pricing page lists
  the free monthly allowance.
- This line in the hosts file (`C:\Windows\System32\drivers\etc\hosts` or
  `/etc/hosts`), added as administrator:

  ```text
  127.0.0.1 trigger-s2
  ```

  Trigger.dev hands its S2 stream endpoint (`trigger-s2`) to the `trigger dev`
  worker on the host, which writes Agent output there. A
  `127.0.0.1 hackerai-minio` line from an older version of this setup is no
  longer used and can be removed.

## First-time setup

### Cloudflare R2 (one-time)

Wrangler creates the buckets and the CORS rule. The API token has to be
created in the dashboard.

1. Create two private buckets (no public bucket URL). `hackerai-files` holds
   uploads. `packets` holds Trigger.dev payloads; Trigger.dev takes the bucket
   from the first segment of each object key, so this name is fixed.

   ```bash
   npx wrangler r2 bucket create hackerai-files
   npx wrangler r2 bucket create packets
   ```

2. The browser uploads and downloads with presigned URLs, so `hackerai-files`
   needs a CORS rule for the app's origin. Save this as `cors.json`:

   ```json
   {
     "rules": [
       {
         "allowed": {
           "origins": ["http://localhost:3000"],
           "methods": ["GET", "PUT", "HEAD"],
           "headers": ["*"]
         },
         "exposeHeaders": ["ETag"],
         "maxAgeSeconds": 3600
       }
     ]
   }
   ```

   Apply it, then confirm:

   ```bash
   npx wrangler r2 bucket cors set hackerai-files --file cors.json
   npx wrangler r2 bucket cors list hackerai-files
   ```

3. In the dashboard, open **R2 > Manage API tokens** and create an **Account
   API token** with **Object Read & Write**, applied to `hackerai-files` and
   `packets` only. Copy the Access Key ID and the Secret Access Key (shown
   once). `npx wrangler whoami` prints the account ID.

### WorkOS (one-time)

1. Use a non-production WorkOS environment (for example Staging). Copy its
   Client ID and API key into `WORKOS_CLIENT_ID` and `WORKOS_API_KEY` in
   `.env.local` (create the file if it does not exist).
2. Configure the application URLs
   ([docs](https://workos.com/docs/authkit/vanilla/nodejs#configure-initiate-login-uri)):
   Redirect URI `http://localhost:3000/callback`, default Sign-out URI
   `http://localhost:3000/`, Initiate login URI `http://localhost:3000/login`.
   The `workos` CLI sets the first two (`workos config redirect add`,
   `workos authkit logout-uris set`); set the Initiate login URI in the
   dashboard.

### Application setup

1. `corepack pnpm install --frozen-lockfile`
2. Put the R2 values in `docker/selfhost/.env` (create the file if it does
   not exist; setup adds the other secrets to it):

   ```text
   R2_ACCOUNT_ID=<account id>
   R2_ACCESS_KEY_ID=<access key id>
   R2_SECRET_ACCESS_KEY=<secret access key>
   R2_BUCKET_NAME=hackerai-files
   ```

3. `pnpm exec convex dev --once --configure` logs in to Convex and creates or
   picks a project; it writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL`
   to `.env.local`. Its first push stops with "WORKOS_AUTH_DOMAIN is used in
   auth config file but its value was not set"; the next step sets it.
4. `pnpm selfhost:setup` generates secrets, starts the services, writes
   `.env.local`, copies the Convex URL into `docker/selfhost/.env` for the
   sandbox, and sets the Convex deployment's environment. It copies the R2
   values into `.env.local` as `AWS_S3_*` and stops before starting containers
   if any R2 value is empty. It never overwrites values you set; it reports
   them instead. Re-run it any time.
5. Fill the AI keys in `.env.local`: `OPENROUTER_API_KEY`, `OPENAI_API_KEY`,
   and `FIRECRAWL_API_KEY` for web search (or `FIRECRAWL_API_URL` for a
   self-hosted Firecrawl). To use an OpenRouter-compatible gateway instead of
   OpenRouter, see [Model gateway](#model-gateway).
6. Trigger.dev, once:
   1. Open <http://localhost:8030> and sign in with any email. No email is
      sent; copy the magic link from
      `docker compose -f docker/selfhost/compose.yml logs trigger-webapp`.
   2. Create an organization and a project. Copy the project ref
      (`proj_…`) into `TRIGGER_PROJECT_ID` and the **dev** secret key
      (`tr_dev_…`) into `TRIGGER_SECRET_KEY` in `.env.local`.
   3. Log the CLI in to the local instance:
      `pnpm exec trigger login -a http://localhost:8030 --profile selfhost`
7. `make run`, open <http://localhost:3000>, and sign in with your WorkOS
   account (the first sign-in creates it).
8. Sandbox for Agent mode:
   1. In HackerAI, open Settings → Remote Control and copy the connect
      token (the `--token` value).
   2. Put it in `HACKERAI_LOCAL_TOKEN` in `docker/selfhost/.env`.
   3. `pnpm selfhost:sandbox`. The first build reuses the published
      `hackerai/sandbox` image; `pnpm docker:build` builds it from source.
   4. In Agent mode, choose the `docker-sandbox` environment. It is the default
      execution host for self-host; the "Cloud" option needs the extra setup
      below.

## Daily use

Start Docker Desktop first. Then one command starts everything: the
containers, the sandbox (once `HACKERAI_LOCAL_TOKEN` is set), the app, the
Convex function sync, and the Trigger.dev worker.

| `make`        | `pnpm`                | Does                                               |
| ------------- | --------------------- | -------------------------------------------------- |
| `make run`    | `pnpm selfhost:start` | Start everything; Ctrl+C stops the app, not Docker |
| `make down`   | `pnpm selfhost:down`  | Stop every container; data stays in Docker volumes |
| `make status` |                       | List containers and their health                   |
| `make logs`   |                       | Follow container logs                              |
| `make setup`  | `pnpm selfhost:setup` | First-time setup; safe to re-run                   |
| `make test`   | `pnpm test:selfhost`  | Tests for the setup scripts                        |

`make` is optional (on Windows: `choco install make`); the `pnpm` scripts do
the same. Containers restart with Docker Desktop unless `make down` stopped
them, so after a reboot `make run` only rebuilds what changed.

`docker compose -f docker/selfhost/compose.yml --profile sandbox down -v`
deletes the local data: Trigger.dev run history, Redis, and the sandbox
identity. Accounts and chats live in the Convex deployment; files in R2 stay
until you delete them from the buckets.

Older versions of this setup ran MinIO, Convex, and a WorkOS-compatible
sign-in service in Docker. Their volumes hold data of that version's local
account and can be deleted once you no longer need it:
`docker volume rm hackerai-selfhost_minio-data hackerai-selfhost_convex-data hackerai-selfhost_workos-data`.

## Model gateway

Model requests go through the OpenRouter client. A gateway that speaks the
same chat-completions API can replace OpenRouter itself:

```bash
OPENROUTER_BASE_URL=https://api.inferhub.dev/v1
OPENROUTER_API_KEY=<gateway key>
# OpenRouter slug=gateway model id; "*" covers every other slug.
OPENROUTER_MODEL_OVERRIDES=deepseek/deepseek-v4.1-flash=cb/deepseek-v4.1-flash,z-ai/glm-5.3-flash=cbcn/glm-5.3-flash,*=cb/deepseek-v4.1-flash
```

- The app keeps using OpenRouter slugs internally, so the model picker,
  pricing, and model-specific behavior are unchanged. Only the request sent to
  the gateway carries the gateway's id. Every model without its own entry is
  served by the `*` model, whatever the picker shows.
- With `OPENROUTER_BASE_URL` set, the app never calls `openrouter.ai`, including
  the generation lookup that would otherwise send this key there.
- Restart `make run` after changing these values: the Trigger.dev worker reads
  `.env.local` only when it starts.
- Gateways that stream reasoning as `reasoning_content` (GLM on InferHub) do
  not show the model's thinking in the UI; answers and tool calls work.

## Sign-in

Sign-in uses WorkOS AuthKit in your own WorkOS environment (see
[WorkOS](#workos-one-time)). `NEXT_PUBLIC_SELF_HOSTED_ENTITLEMENTS=ultra-plan`
(set by the setup, also in the Convex environment) gives every signed-in
account the top tier, because no billing backs a self-hosted install. Anyone
who can sign up in that WorkOS environment could use the app if they could
reach it, which is one more reason to keep every port on `127.0.0.1`.

## Cloud sandbox (optional)

The local `docker-sandbox` runs every Agent command and has the full toolchain,
so cloud (E2B) is optional. To also offer the "Cloud" environment:

1. Create an E2B account, get the API key, and put it in `.env.local`:
   `E2B_API_KEY=e2b_…` (the setup scaffolds an empty line for it).
2. Build the sandbox template into your E2B account (it comes from
   `docker/Dockerfile`, the same image as the local sandbox, so the build is
   long):

   ```bash
   pnpm run e2b:build:prod
   ```

   This publishes the `terminal-agent-sandbox` template. Without it, choosing
   "Cloud" fails because the template does not exist in the account.

3. Restart `make run` so the Trigger.dev worker picks up `E2B_API_KEY`.

A paid tier is required for cloud runs; the self-hosted account already has the
top tier. Leave `E2B_API_KEY` empty to keep cloud disabled and use only
`docker-sandbox`.

## Differences from the hosted product

- Every account has the top tier (see [Sign-in](#sign-in)) and no usage
  limits while running `next dev`.
- Teams, invitations, and organizations return "not available in
  self-hosted mode".
- The Security tab hides the WorkOS session widget; the log-out buttons work.
- Data leaves the machine: accounts and chats are in your Convex deployment,
  uploads and Trigger.dev payloads in your R2 buckets. Trigger.dev run history
  stays in local Docker volumes.
- `INLINE_FILE_URLS_FOR_MODELS=true` (set by the setup) sends images and PDFs
  to the model as base64 data instead of presigned URLs, which works with any
  OpenRouter-compatible gateway. R2 URLs are reachable from the internet, so
  `false` also works with providers that fetch URLs themselves, as the hosted
  app does.
- A self-hosted Firecrawl ignores the search recency filter; Firecrawl cloud
  honors it.
- The Desktop app and the cloud (E2B) sandbox are not wired to this setup.

## Security

- Nothing listens beyond `127.0.0.1`. Do not change the port bindings to
  `0.0.0.0`: the sandbox executes commands for whoever can reach the app.
- The sandbox container has network access to the internet and to the other
  containers.
- Secrets live in `docker/selfhost/.env` and `.env.local`, both gitignored.
  The Convex deployment's environment holds copies of the ones its functions
  need (WorkOS, R2, service keys).

## Troubleshooting

- Setup stops with "Missing Cloudflare R2 credentials": fill the listed keys
  in `docker/selfhost/.env` and re-run `pnpm selfhost:setup`.
- Setup warns "No Convex cloud deployment yet": run
  `pnpm exec convex dev --once --configure`, then re-run the setup.
- `convex dev` fails with "WORKOS_AUTH_DOMAIN is used in auth config file but
  its value was not set": run `pnpm selfhost:setup`, which sets the Convex
  environment.
- Browser uploads fail with a CORS error: the `hackerai-files` CORS rule must
  allow `http://localhost:3000` exactly (scheme and port, no trailing slash).
  Check it with `npx wrangler r2 bucket cors list hackerai-files`.
- Uploads or downloads return 403: the token does not cover the bucket, or
  `R2_ACCOUNT_ID` belongs to another account. Setup keeps existing
  `.env.local` values, so after changing an `R2_*` value, update the matching
  `AWS_S3_*` line in `.env.local` too, re-run `pnpm selfhost:setup`, and
  restart `make run`.
- Agent runs fail with object store errors on large inputs or outputs: the
  token also needs the `packets` bucket.
- Sign-in ends on a WorkOS error page: the Redirect URI in WorkOS must be
  `http://localhost:3000/callback`, and `WORKOS_CLIENT_ID` must belong to the
  same environment as `WORKOS_API_KEY`.
- Convex rejects tokens: the Convex environment's `WORKOS_CLIENT_ID` differs
  from `.env.local`; re-run `pnpm selfhost:setup`, then restart `make run`.
- Agent runs never start: `trigger dev` is not running or not logged in to
  the `selfhost` profile.
- Agent stays on "Thinking…" and the run fails with `S2Error: DNS resolution
failed (ENOTFOUND)`: the `trigger-s2` hosts entry is missing.
- New keys in `.env.local` are ignored by Agent runs: `trigger dev` reads the
  file only when it starts; restart `make run`.
- The sandbox exits with "HACKERAI_CONVEX_URL is empty": run
  `pnpm selfhost:setup`, which copies the Convex URL into
  `docker/selfhost/.env`.
- The sandbox does not appear: `docker compose -f docker/selfhost/compose.yml logs sandbox`.
