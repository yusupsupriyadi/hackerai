# Local Self-Hosting Design

Date: 2026-10-11
Status: approved design, pending implementation plan

**Update (2026-10-11):** at the user's request, file storage moved from the
bundled MinIO container to Cloudflare R2. HackerAI uploads and Trigger.dev
payloads now live in R2 buckets in the user's own Cloudflare account.

**Update (2026-10-11):** at the user's request, sign-in moved from the WorkOS
mock to WorkOS cloud (a non-production environment), and the database from the
self-hosted Convex backend to Convex cloud on the free plan. The mock, the
`WORKOS_API_HOSTNAME` client option, and the Convex HTTP-origin opt-in are
removed. Once JWKS (WorkOS) and storage (R2) were public, nothing kept Convex
local; Convex cloud only loses Redis cancellation pub/sub, which falls back to
polling. Without billing, `NEXT_PUBLIC_SELF_HOSTED_ENTITLEMENTS=ultra-plan`
keeps the top tier. Sections below that describe the mock or the local Convex
backend are historical.

## Goal

Run HackerAI for one person on one Windows 11 PC with Docker Desktop, without
any cloud service except AI model providers (OpenRouter, OpenAI,
abliteration.ai). Success means: after a one-time setup, `pnpm selfhost:up`
plus `pnpm dev:selfhost` gives working login, Ask chat, Agent mode with an
isolated sandbox, file uploads, and web search/open-URL tools.

## Constraints and decisions

- Personal self-host, single user. Billing, quotas, analytics, support chat,
  teams, and invitations are out of scope.
- The existing cloud mode must keep working unchanged. Every local behavior is
  opt-in through environment variables so upstream
  (`hackerai-tech/hackerai`) changes stay easy to merge into the fork
  (`yusupsupriyadi/hackerai`).
- AI model providers stay cloud.
- Authentication: a local WorkOS-compatible mock service (chosen over a native
  auth rewrite or Keycloak/Authentik, because 62 files use
  `@workos-inc/authkit-nextjs` and tiers come from the JWT `entitlements`
  claim).
- Web tools: Firecrawl. The user supplied a Firecrawl cloud key, which removes
  about seven heavy containers and keeps the recency filter working (the
  self-hosted Firecrawl + SearXNG path drops `tbs`). `FIRECRAWL_API_URL` still
  points the adapter at a self-hosted instance if the user moves later.
- Convex stays self-hosted even though a cloud project exists: Convex cloud
  cannot reach the local WorkOS-compatible JWKS.
- Every published port binds to `127.0.0.1`. On this machine
  `host.docker.internal` resolves to the LAN address, so it must not be used for
  browser-facing URLs: that would expose a command-executing tool to the LAN.

## Architecture

Host processes (Windows):

- `next dev -H 127.0.0.1` on port 3000.
- `trigger dev` (Agent worker) against the self-hosted Trigger.dev instance.
- `convex dev` pushing functions to the self-hosted Convex backend.

`docker/selfhost/compose.yml`:

| Service                                                             | Purpose                                                      | Local port       |
| ------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------- |
| `workos-mock` (new)                                                 | Login page, code/refresh exchange, JWKS, user data           | 8787             |
| `convex-backend`, `convex-dashboard`                                | Database and backend                                         | 3210, 3211, 6791 |
| `redis`                                                             | Stream resumption (`REDIS_URL`)                              | 6379             |
| `centrifugo`                                                        | Sandbox relay (existing `docker/centrifugo/config.json`)     | 8000             |
| Trigger.dev `webapp`, `postgres`, `redis`, `electric`, `clickhouse` | Agent runtime                                                | 8030             |
| `sandbox`                                                           | Kali image from `docker/Dockerfile` running `packages/local` | none             |

Addressing rules:

- Browser and host processes use `localhost:<port>`.
- Containers reach each other by compose service name (`convex-backend`,
  `workos-mock`, `centrifugo`, `redis`).
- File storage: HackerAI file uploads and Trigger.dev packets are stored in
  Cloudflare R2 (`hackerai-files` and `packets` buckets). The browser, host
  processes, Convex, and the sandbox container all use the same presigned URLs
  on `https://<account id>.r2.cloudflarestorage.com`, so the single-hostname
  constraint MinIO needed is gone. The bucket CORS rule allows the browser
  origin `http://localhost:3000`.
- Trigger.dev's S2 stream endpoint: the webapp hands `REALTIME_STREAMS_S2_ENDPOINT`
  to the `trigger dev` worker on the host, which writes Agent output there. It is
  `http://trigger-s2:9330/v1`, resolved on the host by a hosts-file entry,
  `127.0.0.1 trigger-s2`.
- Images and Agent-mode PDFs are sent to the model as base64 data URLs when
  `INLINE_FILE_URLS_FOR_MODELS=true` (the setup default). It was added because
  providers could not reach MinIO. R2 URLs are reachable from the internet, so
  `false` (the hosted behavior) now works too; inlining also suits gateways
  that do not fetch URLs.
- `CENTRIFUGO_WS_URL` differs per env store: Convex env (returned to the
  sandbox container by `convex/localSandbox.ts`) uses
  `ws://centrifugo:8000/connection/websocket`; `.env.local` (Next.js and the
  Trigger worker) uses `ws://localhost:8000/connection/websocket`.

Not used: E2B, Upstash, PostHog, Stripe, Intercom, Vercel crons. Their env vars
stay empty. Without Upstash, `checkTokenBucketLimit` skips usage limits outside
production (`lib/rate-limit/token-bucket.ts`), so the local user is not capped.

## Components

### WorkOS mock (`docker/selfhost/workos-mock/`)

A small Node service with no third-party dependencies (RS256 signing and JWK
export via `node:crypto`). It persists one user, the signing key pair, and
refresh tokens in a Docker volume.

Verified integration points:

- `@workos-inc/authkit-nextjs` 4.3.2 reads `WORKOS_API_HOSTNAME`,
  `WORKOS_API_HTTPS`, `WORKOS_API_PORT` (`dist/esm/workos.js`).
- authkit verifies access tokens with `jwtVerify(token, JWKS)` against
  `getJwksUrl(clientId)` and does not check `iss`/`aud`
  (`dist/esm/session.js`).
- `@workos-inc/node` 10.14.0 builds `baseURL` from `apiHostname`, `https`,
  `port` options.

Endpoints:

- Core: `GET /user_management/authorize` (password login page, then redirect to
  `redirect_uri` with `code` and `state`), `POST /user_management/authenticate`
  (`authorization_code` and `refresh_token` grants, WorkOS response shape),
  `GET /sso/jwks/:clientId`, `GET /user_management/sessions/logout`,
  `GET/PUT /user_management/users/:id`, `GET /user_management/users`.
- Stubs: `GET /user_management/organization_memberships` returns an empty list
  (personal account). Team, invitation, and organization mutations return a
  WorkOS-shaped error stating they are unsupported in self-host mode.
- Access token claims: `sub`, `sid`, `iss`
  (`<WORKOS_AUTH_DOMAIN origin>/user_management/<clientId>`, as Convex
  requires), `iat`, `exp`, `entitlements: ["ultra-plan"]`.

The exact SDK method → HTTP path mapping is pinned in the implementation plan
by reading `@workos-inc/node` 10.14.0 sources.

### Application changes (all opt-in)

| File                                    | Change                                                                                                                                                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/api/workos.ts`                     | Pass `apiHostname`/`https`/`port` from `WORKOS_API_*` when set                                                                                                                                                                               |
| `convex/auth.config.ts`                 | Accept an `http://` origin with port only when `WORKOS_AUTH_ALLOW_INSECURE_ORIGIN=true`; update its tests                                                                                                                                    |
| `convex/s3Utils.ts`                     | Optional `AWS_S3_ENDPOINT` for S3-compatible storage (Cloudflare R2); path-style addressing when it is set                                                                                                                                   |
| `lib/utils/file-transform-utils.ts`     | Inline image and PDF file parts as base64 data URLs when `INLINE_FILE_URLS_FOR_MODELS=true`                                                                                                                                                  |
| `lib/chat/trigger-browser-realtime.ts`  | `NEXT_PUBLIC_TRIGGER_API_URL`, defaulting to `https://api.trigger.dev`                                                                                                                                                                       |
| `lib/ai/tools/firecrawl.ts`, `index.ts` | Firecrawl provider when `FIRECRAWL_API_KEY` (cloud) or `FIRECRAWL_API_URL` (self-hosted) is set and the Perplexity/Jina key is not; search via `/v2/search`, open URL via `/v2/scrape`; existing providers unchanged when their keys are set |
| `app/components/SecurityTab.tsx`        | Hide the WorkOS `UserSecurity` widget when `NEXT_PUBLIC_SELF_HOSTED=true` (it calls `api.workos.com` from the browser)                                                                                                                       |

### Sandbox

`docker/selfhost/sandbox.Dockerfile` extends the existing Kali sandbox image
and adds a build of `packages/local`. The container runs the local client with
`--convex-url http://convex-backend:3210`, a connect token from
Settings → Remote Control, and a fixed name `docker-sandbox`. The user selects
that environment once in Agent mode. No automatic E2B-to-local fallback is
added, because in cloud mode it could route commands to an unintended machine.

### Scripts and docs

- `scripts/selfhost-setup.mjs`: generates secrets, the Convex admin key, writes
  `.env.local`, and sets Convex env vars via `convex env set`. Idempotent: never
  overwrites existing secrets and backs up an existing `.env.local`.
- `package.json`: `selfhost:up`, `selfhost:down`, `selfhost:setup`,
  `dev:selfhost`.
- `docs/self-hosting.md`: setup, operations, known gaps.

## Setup flow

1. Set up Cloudflare R2:
   - Create buckets `hackerai-files` and `packets`.
   - Add CORS rule to `hackerai-files` for origin `http://localhost:3000`.
   - Create an R2 Account API token with Object Read & Write for both buckets.
   - Copy credentials into `docker/selfhost/.env`.
2. Start Docker Desktop; add `127.0.0.1 trigger-s2` to
   `C:\Windows\System32\drivers\etc\hosts`; `pnpm install`;
   `pnpm docker:build`.
3. `pnpm selfhost:setup` (reads R2 env vars, populates `.env.local` and Convex
   env, starts containers with healthchecks).
4. Trigger.dev, the one manual step: open `localhost:8030`, sign in with the
   magic link from the webapp container log, create a project, copy the project
   ref and dev secret key into `.env.local`, log the CLI in to the local
   instance.
5. `pnpm dev:selfhost`; open `localhost:3000`; sign in with the local password.
6. Copy the connect token into `docker/selfhost/.env`, start `sandbox`, select
   `docker-sandbox` in Agent mode.

## Error handling

- The mock returns WorkOS-shaped errors (`error`, `error_description`) so the
  patched authkit error handling still applies. Authorization codes are
  single-use and expire after 10 minutes; refresh tokens rotate.
- Firecrawl failures map to the same tool error shape the Perplexity path
  returns.
- The sandbox container uses `restart: unless-stopped` because the local client
  exits after one hour of inactivity.
- Secrets live only in gitignored files (`.env.local`, `docker/selfhost/.env`).
  The fork is public.

## Testing

- Unit tests for the mock: authorize → authenticate → refresh, then verify the
  token with `jose` against its JWKS, as authkit does.
- Unit tests for `convex/auth.config` (insecure flag), `s3Utils` endpoints, the
  realtime URL, and the Firecrawl adapters (mocked `fetch`).
- `pnpm typecheck`, lint on touched files, `docker compose config`.
- Running the full stack (login, chat, Agent) is a smoke test and happens only
  with explicit user approval.

## Risks to resolve in the implementation plan

- Resolved: Trigger health (`lib/health/trigger-health.ts`) is read only by the
  `/api/health/*` uptime endpoints; Agent routes do not gate on it.
- The Trigger.dev v4 self-hosted image tag compatible with SDK/CLI 4.6.3, the
  minimal service set for `trigger dev`, and how
  `scripts/trigger-dev-branch.mjs` targets a self-hosted API URL.
- Convex self-hosted image tag, admin key generation, and the interaction
  between `CONVEX_SELF_HOSTED_*` and `CONVEX_DEPLOYMENT`.
- How the sandbox preference is persisted in the UI.

## Out of scope

Teams and invitations, the Desktop app, production `next start` inside Docker,
replacements for PostHog and Stripe.
