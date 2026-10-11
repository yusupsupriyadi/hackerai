#!/bin/sh
set -eu

if [ -z "${HACKERAI_LOCAL_TOKEN:-}" ]; then
  echo "HACKERAI_LOCAL_TOKEN is empty." >&2
  echo "Copy the token from HackerAI Settings > Remote Control into" >&2
  echo "docker/selfhost/.env, then run: pnpm selfhost:sandbox" >&2
  exit 1
fi

if [ -z "${HACKERAI_CONVEX_URL:-}" ]; then
  echo "HACKERAI_CONVEX_URL is empty: set CONVEX_URL in docker/selfhost/.env" >&2
  echo "(pnpm selfhost:setup copies it from .env.local)." >&2
  exit 1
fi

# The client exits after an hour without commands; the container restart
# policy brings it back with the same persisted environment identity.
exec node /opt/hackerai-local/dist/index.js \
  --token "$HACKERAI_LOCAL_TOKEN" \
  --convex-url "$HACKERAI_CONVEX_URL" \
  --name "${HACKERAI_LOCAL_NAME:-docker-sandbox}"
