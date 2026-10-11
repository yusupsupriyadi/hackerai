# Local Self-Hosting Design

Date: 2026-10-11
Status: approved design, pending implementation plan

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
- Web tools: self-hosted Firecrawl with SearXNG for search.
- Every published port binds to `127.0.0.1`. On this machine
  `host.docker.internal` resolves to the LAN address, so it must not be used for
  browser-facing URLs: that would expose a command-executing tool to the LAN.

## Architecture

Host processes (Windows):

- `next dev -H 127.0.0.1` on port 3000.
- `trigger dev` (Agent worker) against the self-hosted Trigger.dev instance.
- `convex dev` pushing functions to the self-hosted Convex backend.

`docker/selfhost/compose.yml`:

| Service | Purpose | Local port |
| --- | --- | --- |
| `workos-mock` (new) | Login page, code/refresh exchange, JWKS, user data | 8787 |
| `convex-backend`, `convex-dashboard` | Database and backend | 3210, 3211, 6791 |
| `minio` + bucket init job | File storage (S3 API) | 9000, 9001 |
| `redis` | Stream resumption (`REDIS_URL`) | 6379 |
| `centrifugo` | Sandbox relay (existing `docker/centrifugo/config.json`) | 8000 |
| Trigger.dev `webapp`, `postgres`, `redis`, `electric`, `clickhouse` | Agent runtime | 8030 |
| `sandbox` | Kali image from `docker/Dockerfile` running `packages/local` | none |
| Firecrawl `api`, `worker`, `playwright`, `redis`, plus `searxng` | Web search and scraping | 3002 |

Addressing rules:

- Browser and host processes use `localhost:<port>`.
- Containers reach each other by compose service name (`convex-backend`,
  `minio`, `workos-mock`, `centrifugo`).
- S3 presigned URLs are signed with the public endpoint
  `http://localhost:9000` (signing needs no network), while Convex server-side
  S3 operations use `http://minio:9000`.
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

| File | Change |
| --- | --- |
| `app/api/workos.ts` | Pass `apiHostname`/`https`/`port` from `WORKOS_API_*` when set |
| `convex/auth.config.ts` | Accept an `http://` origin with port only when `WORKOS_AUTH_ALLOW_INSECURE_ORIGIN=true`; update its tests |
| `convex/s3Utils.ts` | Optional `AWS_S3_ENDPOINT` (server operations) and `AWS_S3_PUBLIC_ENDPOINT` (presigning, defaults to `AWS_S3_ENDPOINT`); path-style addressing when an endpoint is set |
| `lib/chat/trigger-browser-realtime.ts` | `NEXT_PUBLIC_TRIGGER_API_URL`, defaulting to `https://api.trigger.dev` |
| `lib/ai/tools/web-search.ts`, `open-url.ts`, `index.ts` | Firecrawl provider when `FIRECRAWL_API_URL` is set and the Perplexity/Jina key is not; search via `/v2/search`, open URL via `/v2/scrape`; existing providers unchanged when their keys are set |
| `app/components/SecurityTab.tsx` | Hide the WorkOS `UserSecurity` widget when `NEXT_PUBLIC_SELF_HOSTED=true` (it calls `api.workos.com` from the browser) |

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

1. Start Docker Desktop; `pnpm install`; `pnpm docker:build`.
2. `pnpm selfhost:up` (healthchecks gate dependent services).
3. `pnpm selfhost:setup`.
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

- Whether the Agent route gates on Trigger health written by the
  `/api/cron/trigger-health` cron, which does not run locally.
- The Trigger.dev v4 self-hosted image tag compatible with SDK/CLI 4.6.3, the
  minimal service set for `trigger dev`, and how
  `scripts/trigger-dev-branch.mjs` targets a self-hosted API URL.
- Convex self-hosted image tag, admin key generation, and the interaction
  between `CONVEX_SELF_HOSTED_*` and `CONVEX_DEPLOYMENT`.
- Whether Firecrawl publishes prebuilt images or must be built from source, and
  which recency filters survive with SearXNG.
- How the sandbox preference is persisted in the UI.

## Out of scope

Teams and invitations, the Desktop app, production `next start` inside Docker,
replacements for PostHog and Stripe.
