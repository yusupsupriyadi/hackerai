# Self-hosted stack, see docs/self-hosting.md. Each target wraps a pnpm script
# or a single docker compose command, so recipes run under cmd.exe or sh.

COMPOSE = docker compose -f docker/selfhost/compose.yml --profile sandbox

.PHONY: run setup up down sandbox logs status test

# Docker services and sandbox, then the app, Convex functions, and the
# Trigger.dev worker. Ctrl+C stops the app; the containers keep running.
run:
	pnpm selfhost:start

# First-time setup, also safe to re-run: secrets, Convex admin key, .env.local.
setup:
	pnpm selfhost:setup

up:
	pnpm selfhost:up

# Stops every container; data stays in Docker volumes.
down:
	pnpm selfhost:down

sandbox:
	pnpm selfhost:sandbox

logs:
	$(COMPOSE) logs -f --tail 50

status:
	$(COMPOSE) ps

test:
	pnpm test:selfhost
