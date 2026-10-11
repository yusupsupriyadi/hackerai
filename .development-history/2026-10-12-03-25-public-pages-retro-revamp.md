# Revamp /product, /pricing, and /trust in a retro OS style

## Summary

Rebuilt the three public pages on the dark base in a typesafe.ai-inspired style with its own identity: giant grotesk headings, square retro windows with Geist Pixel title bars, and white pixel distortion as the only accent. `/product` adds a Three.js voxel logo; pricing and trust copy and facts now describe DiggerAI rather than HackerAI.

## Changes

- `app/product/page.tsx`, `app/product/GlitchMark.tsx`: product page and the voxel logo (assembles, glitches on hover/tap, shatters on scroll), rasterized at runtime from the rendered `HackerAISVG`.
- `app/pricing/page.tsx`, `app/pricing/PricingPlans.tsx`: Free, Pro, Pro+, Ultra only (Team and Extra Usage are Stripe-only); billing copy describes Polar; retro monthly/yearly radio group.
- `app/trust/page.tsx`: document layout with a sticky index; subprocessors and execution facts match the self-hosted stack (InferHub, OpenAI moderation, Firecrawl, E2B US, Convex, Cloudflare R2, WorkOS, Polar).
- `components/public/PublicSiteFooter.tsx`: wordmark footer with a single internal link list in place of the four-column template; no GitHub, help center, or status links.
- `app/components/Header.tsx`: menu-bar navbar (pixel labels, inverted current page, square buttons, labelled mobile menu); same auth, menu, and focus behavior; the wordmark hides below 400 px so the bar fits at 320 px.
- `components/public/retro/*`: shared window chrome, animated dither field, crop marks, spec list, font, and class recipes.
- `lib/seo/site.ts`: product, pricing, and trust last-modified dates.
- `package.json`, `pnpm-lock.yaml`: add `three` and `@types/three`.

## Decisions

- Theme stays dark and the accent monochrome, per the user.
- No GitHub links on the public pages, per the user (the code is Apache-2.0, so no source link is required); the trust page's source-code section went with them.
- Trust claims come from `.env.local` service keys, `docs/self-hosting.md`, `docs/polar-billing.md`, and the code (Firecrawl fallback, US-only E2B, Stripe-only account-deletion cancel, hidden WorkOS MFA widget when self-hosted).
- `prefers-reduced-motion` renders every field and the logo still.

## Verification

- `tsc --noEmit`, `eslint`, `prettier --check`, `jest lib/seo`: pass.
- BrowserOS on the local dev server: 360 to 1440 px with no overflow in `main`, link targets, anchors, billing toggle (click and arrow keys), zoom dialog with Escape, reduced motion, clean console in fresh tabs.

## Limitations

- Trust has no security contact yet; the page says so.
- Account deletion does not cancel a Polar subscription; the trust page says so until that is built.
- Header overflows by 15 px at 320 px on every public page (shared component, pre-existing).

## Follow-up

- Add a DiggerAI security contact, and update trust and pricing when billing or hosting changes.
