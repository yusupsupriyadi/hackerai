import type { SubscriptionTier } from "@/types";

/** All known paid entitlement slugs, grouped by tier (highest first). */
const TIER_ENTITLEMENTS: ReadonlyArray<{
  tier: SubscriptionTier;
  slugs: readonly string[];
}> = [
  {
    tier: "ultra",
    slugs: ["ultra-plan", "ultra-monthly-plan", "ultra-yearly-plan"],
  },
  { tier: "team", slugs: ["team-plan"] },
  {
    tier: "pro-plus",
    slugs: ["pro-plus-plan", "pro-plus-monthly-plan", "pro-plus-yearly-plan"],
  },
  {
    tier: "pro",
    slugs: ["pro-plan", "pro-monthly-plan", "pro-yearly-plan"],
  },
];

const splitEntitlements = (value: string): string[] =>
  value
    .split(",")
    .map((entitlement) => entitlement.trim())
    .filter(Boolean);

/**
 * Entitlements a self-hosted install grants every signed-in user, because its
 * WorkOS environment has no billing behind it. Ignored once a billing provider
 * is configured. Never set in hosted deployments. Read per call: the browser
 * bundle inlines the literal references.
 */
const selfHostedEntitlements = (): string[] =>
  process.env.NEXT_PUBLIC_BILLING_PROVIDER
    ? []
    : splitEntitlements(process.env.NEXT_PUBLIC_SELF_HOSTED_ENTITLEMENTS ?? "");

const withSelfHostedEntitlements = (
  entitlements: readonly string[],
): string[] => [
  ...entitlements,
  ...selfHostedEntitlements().filter(
    (entitlement) => !entitlements.includes(entitlement),
  ),
];

/**
 * Safely coerce a raw entitlements value (from a JWT or session) into a
 * typed string array. WorkOS sends an array; Polar billing sends a
 * comma-separated string through the WorkOS JWT template.
 */
export function parseEntitlements(raw: unknown): string[] {
  return withSelfHostedEntitlements(
    Array.isArray(raw)
      ? raw.filter((e: unknown): e is string => typeof e === "string")
      : typeof raw === "string"
        ? splitEntitlements(raw)
        : [],
  );
}

/**
 * Resolve the highest subscription tier present in an entitlements list.
 * Returns `"free"` when no paid entitlement matches.
 */
export function resolveSubscriptionTier(
  tokenEntitlements: readonly string[],
): SubscriptionTier {
  const entitlements = withSelfHostedEntitlements(tokenEntitlements);
  for (const { tier, slugs } of TIER_ENTITLEMENTS) {
    if (slugs.some((s) => entitlements.includes(s))) {
      return tier;
    }
  }
  return "free";
}

export function hasPaidEntitlement(entitlements: readonly string[]): boolean {
  return resolveSubscriptionTier(entitlements) !== "free";
}
