import { NextRequest, NextResponse } from "next/server";
import { webhooks } from "@polar-sh/sdk/2026-10";

import { polarWebhookUserId, syncPolarEntitlements } from "@/lib/billing/polar";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/polar/webhook
 * Keeps WorkOS entitlements in step with Polar subscriptions.
 *
 * Configure in Polar (Settings → Webhooks):
 * - Endpoint URL: https://your-domain.com/api/polar/webhook
 * - Format: Raw
 * - Events: customer.state_changed and the subscription.* events
 */
export async function POST(req: NextRequest) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Polar webhooks are not configured" },
      { status: 503 },
    );
  }

  let event: webhooks.WebhookPayload;
  try {
    event = await webhooks.validateEvent(
      await req.text(),
      Object.fromEntries(req.headers),
      secret,
    );
  } catch (error) {
    if (error instanceof webhooks.PolarWebhookUnknownTypeError) {
      return NextResponse.json({ received: true });
    }
    if (error instanceof webhooks.PolarWebhookVerificationError) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 403 },
      );
    }
    if (error instanceof webhooks.PolarWebhookError) {
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 },
      );
    }
    throw error;
  }

  const userId = polarWebhookUserId(event);
  if (!userId) return NextResponse.json({ received: true });

  try {
    await syncPolarEntitlements(userId);
  } catch (error) {
    // A 500 makes Polar retry the delivery.
    logger.error(
      "Polar entitlement sync failed",
      error instanceof Error ? error : undefined,
      {
        event: "billing.polar_webhook_sync_failed",
        polar_event_type: event.type,
        route: "/api/polar/webhook",
      },
    );
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
