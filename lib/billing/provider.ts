/**
 * Self-hosted installs can sell plans through Polar instead of Stripe. Read per
 * call: the browser bundle inlines the literal `process.env` reference.
 */
export const isPolarBilling = (): boolean =>
  process.env.NEXT_PUBLIC_BILLING_PROVIDER === "polar";
