# Remove remaining user-visible HackerAI references

## Summary

Removed every user-visible link to HackerAI properties (help center, status page, GitHub, contact email, social account, desktop release downloads) and replaced the HackerAI name in legal pages and structured data with DiggerAI, per the user. Where DiggerAI has no equivalent yet, the link is removed rather than pointed elsewhere.

## Changes

- `app/components/SidebarUserNav.tsx`: help submenu reduced to Security & Trust (help center, status, GitHub, X removed).
- `app/components/{BillingRecoveryPanel,ConvexErrorBoundary,MessageErrorState,ExtraUsageSection,RemoteControlTab}.tsx`, `lib/suspensionMessage.ts`: support and help links removed; copy made neutral.
- `lib/system-prompt.ts`: local setup points at Settings → Remote Control; no help-center pointer.
- `app/privacy-policy`, `app/terms-of-service`: "HackerAI LLC" becomes "DiggerAI"; privacy contact says no channel exists yet.
- `app/download/*`: desktop downloads point at `/download`, which says DiggerAI builds are not published.
- `lib/seo/site.ts`: legal name DiggerAI, no GitHub `sameAs`, page dates.
- Tests updated for the removed links.

## Decisions

- No invented replacements: no support email, legal entity, or desktop build URL.

## Verification

- `tsc --noEmit`, eslint on changed files: pass.
- Jest on 13 related suites: all pass except `BillingRecoveryPanel` "shows the actual balance", which fails on this machine's locale (`US$25,00`), unrelated.
- BrowserOS: zero `hackerai` text on public and legal pages, download notice, clean console.

## Limitations

- Still pending outside code: DiggerAI domain (`SITE_URL`, `robots.txt`), `npx @hackerai/local` package name in the Remote Control command, PentestGPT migration UI, screenshots that show HackerAI UI, privacy contact, legal review of the governing-law clause.

## Follow-up

- Provide a domain, support contact, and desktop builds, then wire them in.
