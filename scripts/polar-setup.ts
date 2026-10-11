/**
 * Create the Polar products DiggerAI sells, one per plan, priced from
 * lib/pricing/config.ts. Safe to re-run: products are matched by
 * `metadata.plan`, never edited, and price mismatches are only reported.
 *
 *   npx tsx --env-file=.env.local scripts/polar-setup.ts
 */
import { createPolar } from "@polar-sh/sdk/2026-10";

import { PRICING } from "../lib/pricing/config";

const accessToken = process.env.POLAR_ACCESS_TOKEN;
if (!accessToken) {
  console.error(
    "Set POLAR_ACCESS_TOKEN (and POLAR_SERVER=sandbox for the sandbox).",
  );
  process.exit(1);
}

const polar = createPolar({
  accessToken,
  environment:
    process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production",
});

// Descriptions reuse the plan features shown in the pricing dialog.
const TIERS = [
  {
    tier: "pro",
    name: "DiggerAI Pro",
    description:
      "Access to the best AI models for pentesting, extended limits, file uploads, cloud agents, and the maximum context window.",
  },
  {
    tier: "pro-plus",
    name: "DiggerAI Pro+",
    description: "Everything in Pro, with 3x more usage than Pro.",
  },
  {
    tier: "ultra",
    name: "DiggerAI Ultra",
    description:
      "Everything in Pro, with 10x more usage than Pro and priority access to new features.",
  },
] as const;

const INTERVALS = [
  { key: "monthly", interval: "month", label: "monthly", months: 1 },
  // PRICING lists yearly plans as a monthly amount billed once a year.
  { key: "yearly", interval: "year", label: "yearly", months: 12 },
] as const;

async function main() {
  const existing = new Map<string, { id: string; amount?: number }>();
  for await (const product of polar.products.iterList({ is_archived: false })) {
    const plan = product.metadata?.plan;
    if (typeof plan !== "string") continue;
    const price = product.prices.find(
      (p) => "amount_type" in p && p.amount_type === "fixed",
    ) as { price_amount?: number } | undefined;
    existing.set(plan, { id: product.id, amount: price?.price_amount });
  }

  for (const { tier, name, description } of TIERS) {
    for (const { key, interval, label, months } of INTERVALS) {
      const plan = `${tier}-${key}-plan`;
      const amount = PRICING[tier][key] * months * 100;
      const found = existing.get(plan);

      if (found) {
        const note =
          found.amount === amount
            ? "ok"
            : `price is ${found.amount} cents, expected ${amount}; fix it in Polar`;
        console.log(`${plan}: exists (${found.id}), ${note}`);
        continue;
      }

      const product = await polar.products.create({
        name: `${name} (${label})`,
        description,
        recurring_interval: interval,
        prices: [
          { amount_type: "fixed", price_currency: "usd", price_amount: amount },
        ],
        metadata: { plan, tier },
      });
      console.log(
        `${plan}: created (${product.id}), ${amount} cents per ${interval}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
