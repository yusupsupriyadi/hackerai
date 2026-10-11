import { createPolar, type models, webhooks } from "@polar-sh/sdk/2026-10";
import { withAuth } from "@workos-inc/authkit-nextjs";

import { workos } from "@/app/api/workos";
import { planLookupKeyToTier } from "@/lib/analytics/paid-funnel";
import { isEndedSessionRefreshError } from "@/lib/auth/expected-auth-errors";
import type { SubscriptionCancellationStatus } from "@/lib/billing/api-types";

/**
 * Each Polar product names its plan in `metadata.plan`, so products can be
 * recreated (sandbox, then production) without code changes. No Team plan.
 */
export const POLAR_PLANS = [
  "pro-monthly-plan",
  "pro-yearly-plan",
  "pro-plus-monthly-plan",
  "pro-plus-yearly-plan",
  "ultra-monthly-plan",
  "ultra-yearly-plan",
] as const;

export type PolarPlan = (typeof POLAR_PLANS)[number];

/**
 * WorkOS user metadata key. The WorkOS JWT template copies it into the
 * `entitlements` claim that Next.js, Convex, and the browser read.
 */
export const BILLING_ENTITLEMENTS_METADATA_KEY = "billing_entitlements";

export const isPolarPlan = (value: unknown): value is PolarPlan =>
  typeof value === "string" &&
  (POLAR_PLANS as readonly string[]).includes(value);

/** The tier slug plus the plan slug, e.g. `pro-plan` and `pro-monthly-plan`. */
export const planEntitlements = (plan: PolarPlan): string[] => [
  `${planLookupKeyToTier(plan)}-plan`,
  plan,
];

let polarClient: ReturnType<typeof createPolar> | null = null;

function getPolar() {
  if (polarClient) return polarClient;

  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("POLAR_ACCESS_TOKEN is not configured");
  }

  polarClient = createPolar({
    accessToken,
    environment:
      process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production",
    timeout: 15,
  });
  return polarClient;
}

const isNotFound = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  (error as { statusCode?: unknown }).statusCode === 404;

/** Polar customers are keyed by the WorkOS user ID (`external_id`). */
async function getCustomerState(
  userId: string,
): Promise<models.CustomerState | null> {
  try {
    return await getPolar().customers.getStateExternal(userId);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function activePlans(
  state: models.CustomerState | null,
): Promise<PolarPlan[]> {
  if (!state) return [];
  const polar = getPolar();
  const products = await Promise.all(
    state.active_subscriptions.map((subscription) =>
      polar.products.get(subscription.product_id),
    ),
  );
  return products.map((product) => product.metadata?.plan).filter(isPolarPlan);
}

/**
 * Copy the user's active Polar plans into their WorkOS metadata. Writes only
 * on change, so webhooks and every entitlement refresh can call it.
 */
export async function syncPolarEntitlements(userId: string): Promise<string[]> {
  const plans = await activePlans(await getCustomerState(userId));
  const entitlements = [...new Set(plans.flatMap(planEntitlements))];
  const value = entitlements.length > 0 ? entitlements.join(",") : null;

  const user = await workos.userManagement.getUser(userId);
  if ((user.metadata?.[BILLING_ENTITLEMENTS_METADATA_KEY] ?? null) !== value) {
    await workos.userManagement.updateUser({
      userId,
      metadata: { [BILLING_ENTITLEMENTS_METADATA_KEY]: value },
    });
  }

  return entitlements;
}

export type PolarCheckoutResult =
  | { status: 200; body: { url: string } }
  | { status: 400 | 409 | 503; body: { error: string; code?: string } };

export async function createPolarCheckout(
  userId: string,
  requestedPlan: unknown,
  baseUrl: string,
): Promise<PolarCheckoutResult> {
  if (!isPolarPlan(requestedPlan)) {
    return { status: 400, body: { error: "This plan is not available." } };
  }

  const state = await getCustomerState(userId);
  if (state && state.active_subscriptions.length > 0) {
    return {
      status: 409,
      body: {
        error:
          "You already have a plan. Change it from Payment → Manage in Account settings.",
        code: "subscription_exists",
      },
    };
  }

  const polar = getPolar();
  const { items } = await polar.products.list({
    metadata: { plan: requestedPlan },
    is_archived: false,
    limit: 1,
  });
  const product = items[0];
  if (!product) {
    return {
      status: 503,
      body: { error: "This plan isn't available for checkout yet." },
    };
  }

  const user = await workos.userManagement.getUser(userId);
  const successUrl = new URL(baseUrl);
  successUrl.searchParams.set("refresh", "entitlements");

  const checkout = await polar.checkouts.create({
    products: [product.id],
    external_customer_id: userId,
    customer_email: user.email,
    customer_name:
      [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
    success_url: successUrl.toString(),
    return_url: baseUrl,
    metadata: { plan: requestedPlan },
  });

  return { status: 200, body: { url: checkout.url } };
}

/** Polar's hosted portal handles plan changes, cancellation, and payment methods. */
export async function createPolarPortalUrl(
  userId: string,
  returnUrl: string,
): Promise<string> {
  const session = await getPolar().customerSessions.create({
    external_customer_id: userId,
    return_url: returnUrl,
  });
  return session.customer_portal_url;
}

export async function getPolarSubscriptionStatus(
  userId: string,
): Promise<SubscriptionCancellationStatus> {
  const state = await getCustomerState(userId);
  if (!state) return { hasActiveSubscription: false, cancelAtPeriodEnd: false };

  const subscription = state.active_subscriptions[0];
  if (!subscription) {
    return {
      billingAccountAvailable: true,
      hasActiveSubscription: false,
      cancelAtPeriodEnd: false,
    };
  }

  // The SDK types this field loosely; Polar sends the subscription status.
  const status = String(subscription.status);
  return {
    billingAccountAvailable: true,
    hasActiveSubscription: true,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: Date.parse(subscription.current_period_end),
    ...((status === "active" || status === "trialing") && {
      subscriptionStatus: status,
    }),
    renewalAmountDollars: subscription.amount / 100,
    renewalCurrency: subscription.currency,
    renewalInterval: subscription.recurring_interval,
  };
}

export async function getPolarBillingUserId(): Promise<string> {
  let auth: Awaited<ReturnType<typeof withAuth>>;
  try {
    auth = await withAuth();
  } catch (error) {
    if (isEndedSessionRefreshError(error)) {
      throw new Error("User not authenticated", { cause: error });
    }
    throw error;
  }
  if (!auth.user?.id) throw new Error("User not authenticated");
  return auth.user.id;
}

/**
 * The WorkOS user a Polar webhook is about, when the event can change what
 * the user is entitled to.
 */
export function polarWebhookUserId(
  event: webhooks.WebhookPayload,
): string | null {
  if (event.type === "customer.state_changed") {
    return event.data.external_id ?? null;
  }
  if (event.type.startsWith("subscription.")) {
    const data = event.data as { customer?: { external_id?: string | null } };
    return data.customer?.external_id ?? null;
  }
  return null;
}
