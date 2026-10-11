# Self-host file storage on Cloudflare R2

## Summary

Replace the bundled MinIO container with Cloudflare R2 for HackerAI uploads
and Trigger.dev's object store, and migrate the existing files.

## Changes

- `docker/selfhost/compose.yml`: MinIO service and volume removed; `trigger-webapp` object store points at R2 (`OBJECT_STORE_REGION=auto`).
- `scripts/selfhost-env.mjs`, `scripts/selfhost-setup.mjs`: `R2_*` keys in `docker/selfhost/.env` feed `AWS_S3_*` in `.env.local` and Convex; setup stops when they are empty; `hackerai-minio` hosts entry no longer required.
- `convex/s3Utils.ts`: comment only; tests in `scripts/__tests__/selfhost-env.test.mjs`, `convex/__tests__/s3Utils.test.ts`.
- `docs/self-hosting.md`, spec: R2 setup (buckets, CORS, token), troubleshooting, privacy note.

## Decisions

- Bucket `packets` is fixed: Trigger.dev uses the first key segment as the bucket in access-key mode.
- Kept bucket name `hackerai-files`; old rows store region `us-east-1`, which R2 aliases to `auto`.
- `INLINE_FILE_URLS_FOR_MODELS` stays `true` (works with any gateway).

## Verification

- `pnpm test:selfhost` 30/30, jest s3Utils + s3Actions 60/60, `pnpm typecheck`, eslint, prettier: pass.
- Against R2 with the app's `convex/s3Utils.ts`: presigned PUT with CORS preflight, HEAD, GET, delete, and a migrated file read with region `us-east-1`: pass.
- `pnpm selfhost:setup`: all containers healthy; Convex env holds the R2 endpoint; Trigger.dev packet presign PUT/GET round-trip lands in R2 `packets`.
- 6 objects copied from MinIO with matching size and Content-Type.

## Limitations

- No browser upload through the running app was exercised.

## Follow-up

- Delete the `hackerai-selfhost_minio-data` volume and the `hackerai-minio` hosts line once uploads are confirmed in the app.
