# Rebrand HackerAI to DiggerAI (user-visible)

## Summary

Renamed the user-facing product name from HackerAI to DiggerAI and replaced the logo with the user-supplied pixel-art drill (ElevenLabs gpt-image-2.5), traced at 4px into a 94x183 rectilinear SVG path.

## Changes

- `app/**`, `components/**`: UI copy, aria labels, metadata, manifest, tier names ("DiggerAI Pro").
- `lib/**`, `convex/**`, `trigger/**`, `types/**`: system prompts, subagent profiles, tool descriptions, user-facing errors, Stripe line-item names.
- `packages/desktop`, `packages/local`: in-app strings, window title, descriptions, CLI output.
- `README.md`, `docs/*.md`: product name in prose.
- `components/icons/hackerai-svg.tsx`, `public/*.png`, `public/favicon.ico`: new logo.
- `app/layout.tsx`, `lib/seo/site.ts`: explicit `metadata.icons`; OG/Twitter/JSON-LD logo now resolves against `NEXT_PUBLIC_BASE_URL` instead of the upstream hackerai.co asset.

## Decisions

- Kept internal identity: `HACKERAI_*` env vars, `@hackerai/*` packages, component/file names, storage keys, `hackerai.co` URLs (no new domain yet), desktop `productName`/bundle id/user-agent, OpenRouter app title.
- Kept "HackerAI, LLC" in LICENSE, notices, legal pages, and copyright lines.
- Kept PostHog survey name/question literals: they are validated against the survey defined in PostHog.

## Verification

- `tsc --noEmit`: pass.
- `eslint` on 109 changed files: 0 errors.
- `jest` full suite: 45 failures in 18 suites, all locale/Windows/source-contract issues unrelated to the rename.

## Limitations

- Desktop app icons, OG screenshots (`public/images/hackerai-*.png`), and terms-of-service legal text still show HackerAI.

## Follow-up

- Swap URLs/emails once a DiggerAI domain exists.
