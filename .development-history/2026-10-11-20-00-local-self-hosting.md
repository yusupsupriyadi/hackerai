# Self-hosting with Docker and free cloud accounts

## Summary

Run HackerAI for one person on one machine: app, Trigger.dev, Centrifugo,
Redis, and the sandbox local; WorkOS (sign-in), Convex (database, free plan),
Cloudflare R2 (storage, see the R2 report), AI providers, and Firecrawl in the
cloud. Hosted behavior is unchanged; self-host behavior is opt-in through env.

## Changes

- `docker/selfhost/compose.yml`: Redis, Centrifugo, Trigger.dev v4.6.3, sandbox; ports bound to 127.0.0.1.
- `docker/selfhost/sandbox/`: Kali sandbox image running `packages/local` against the Convex cloud URL.
- `scripts/selfhost-*.mjs`, `Makefile`: idempotent setup (secrets, `.env.local`, Convex cloud env) and `make run`.
- `lib/auth/entitlements.ts`: `NEXT_PUBLIC_SELF_HOSTED_ENTITLEMENTS` (ultra-plan) for every signed-in user.
- `lib/ai/openrouter-model-overrides.ts`, `lib/ai/providers.ts`: OpenRouter-compatible gateway (InferHub) with slug overrides.
- `convex/s3Utils.ts`, `lib/chat/trigger-browser-realtime.ts`, `lib/utils/file-transform-utils.ts`, `lib/ai/tools/firecrawl.ts`, `app/components/SecurityTab.tsx`: configurable endpoints, inline media, Firecrawl, hidden session widget.
- `docs/self-hosting.md`, spec in `docs/superpowers/specs/`.

## Decisions

- Sign-in and Convex moved to cloud at the user's request; the WorkOS mock, its host overrides, and the local Convex backend were removed.
- Convex cloud gets no `REDIS_URL` (unreachable); cancellation falls back to polling.
- Trigger.dev stays local; its S2 endpoint needs a `trigger-s2` hosts entry.

## Verification

- `pnpm test:selfhost`, targeted jest, `pnpm typecheck`: pass. Full jest: 18 suites fail identically on the untouched baseline (Windows).
- Convex cloud: env set, schema, functions, and the aggregate component pushed. WorkOS staging key and JWKS: HTTP 200; URLs saved and read back.
- Smoke test on the final stack: WorkOS cloud sign-in, `ultra` tier from `/api/entitlements`, and an Agent message answered through InferHub.
- Both sandboxes execute commands: `docker-sandbox` (local, exit 0, hostname `docker-sandbox`) and Cloud E2B after building the `terminal-agent-sandbox` template into the user's account (`pnpm run e2b:build:prod`, 7m17s; run `Success`, hostname `e2b.local`).

## Limitations

- File uploads and web search were not exercised on the final stack.
- Teams, invitations, and the Desktop app are not wired.

## Follow-up

- Delete the old local volumes listed in docs/self-hosting.md when no longer needed.
- Rotate the E2B and other keys that were pasted into chat.
