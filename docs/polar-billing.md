# Polar billing

A self-hosted install can sell Pro, Pro+, and Ultra through
[Polar](https://polar.sh) instead of Stripe. Polar is the merchant of record:
it runs checkout, the customer portal, tax, and receipts. Team plans, extra
usage, retention offers, and pauses stay Stripe-only.

## How access reaches the app

Every part of the app (Next.js, Convex, the browser) reads the user's tier
from the `entitlements` claim in the WorkOS session token. With Polar:

1. `/api/subscribe` opens a Polar checkout for the product whose
   `metadata.plan` matches the chosen plan, with the WorkOS user ID as the
   Polar customer's external ID.
2. `syncPolarEntitlements` (`lib/billing/polar.ts`) reads the customer's
   active subscriptions and writes the plan slugs, comma-separated, to the
   WorkOS user metadata key `billing_entitlements`.
3. The WorkOS JWT template copies that metadata into the `entitlements`
   claim, and `parseEntitlements` accepts the comma-separated string.

The sync runs from `/api/entitlements` (on return from checkout or the
portal, and on page load for users without a paid claim) and from the Polar
webhook. Plan changes, cancellation, cards, and invoices happen in Polar's
customer portal (Account settings, Payment, Manage).

`NEXT_PUBLIC_BILLING_PROVIDER=polar` also turns off
`NEXT_PUBLIC_SELF_HOSTED_ENTITLEMENTS`, so nobody gets a paid tier for free.
To give one account a tier without paying (the owner, for example), set the
WorkOS user metadata key `granted_entitlements` (for example `ultra-plan`).
The template prefers it over `billing_entitlements`.

## Setup

Start in the Polar sandbox (`sandbox.polar.sh`, no real payments), then repeat
with a production organization.

1. **Polar organization settings** (Settings, Preferences): keep "Allow
   multiple subscriptions" off, set Proration to "Prorate & charge now" so an
   upgrade is charged when it happens, and keep "Enable subscription plan
   changes" on in the customer portal section.
2. **Access token** (Settings, Developers): an organization access token with
   `checkouts:read/write`, `customers:read/write`, `customer_sessions:write`,
   `products:read/write`, and `subscriptions:read/write`. Polar asks you to
   sign in again before it creates a token.
3. **`.env.local`**, then restart `pnpm dev:selfhost` (Next.js inlines
   `NEXT_PUBLIC_*` values at build time):

   ```text
   NEXT_PUBLIC_BILLING_PROVIDER=polar
   POLAR_ACCESS_TOKEN=polar_oat_...
   POLAR_SERVER=sandbox        # remove for production
   POLAR_WEBHOOK_SECRET=...    # step 7
   ```

4. **Convex**, so its functions also ignore the self-hosted grant:
   `pnpm exec convex env set NEXT_PUBLIC_BILLING_PROVIDER polar`.
   `pnpm selfhost:setup` never removes it.
5. **Products**: `npx tsx --env-file=.env.local scripts/polar-setup.ts`
   creates one product per plan, priced from `lib/pricing/config.ts`. Re-runs
   skip existing products and report price mismatches.
6. **WorkOS JWT template** (Authentication, Features, JWT template; one per
   WorkOS environment):

   ```json
   {
     "entitlements": {{ user.metadata.granted_entitlements || user.metadata.billing_entitlements }}
   }
   ```

7. **Webhook** (Polar Settings, Webhooks): endpoint
   `https://<public host>/api/polar/webhook`, format Raw, events
   `customer.state_changed` and the `subscription.*` events. Put the signing
   secret in `POLAR_WEBHOOK_SECRET`.

## Pitfalls

- Polar cannot deliver webhooks to `localhost`. New purchases still appear
  right away through the pull sync, but a cancellation or a failed renewal
  only reaches a paying user when their entitlements refresh, for example on
  return from the portal. Give the app a public URL for webhooks; for a test,
  `cloudflared tunnel --url http://localhost:3000` prints a temporary one.
- `granted_entitlements` replaces billing for that user entirely; remove it
  to let Polar decide again.
- Sandbox and production use separate tokens, products, and webhook secrets.
  Moving to production means a new token, re-running the product script,
  a new webhook, and removing `POLAR_SERVER`.
