import type { Metadata } from "next";
import Link from "next/link";

import Header from "@/app/components/Header";
import { PublicSiteFooter } from "@/components/public/PublicSiteFooter";
import { CropMarks } from "@/components/public/retro/CropMarks";
import { PixelField } from "@/components/public/retro/PixelField";
import { RetroWindow } from "@/components/public/retro/RetroWindow";
import { SpecList } from "@/components/public/retro/SpecList";
import {
  display,
  focusOnPaper,
  giantLink,
  shell,
  windowLink,
} from "@/components/public/retro/styles";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  SOFTWARE_APPLICATION_JSON_LD,
  canonicalMetadata,
} from "@/lib/seo/site";
import { cn } from "@/lib/utils";

import { PricingPlans } from "./PricingPlans";

const description =
  "Compare DiggerAI Free, Pro, Pro+, and Ultra pricing for AI-assisted penetration testing, local Agent mode, files, and cloud agents.";

export const metadata: Metadata = {
  ...canonicalMetadata("/pricing"),
  title: "Pricing | DiggerAI",
  description,
  openGraph: {
    title: "DiggerAI Pricing",
    description,
    type: "website",
    url: "/pricing",
  },
  twitter: {
    card: "summary",
    title: "DiggerAI Pricing",
    description,
  },
};

export const dynamic = "force-static";

export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <JsonLd data={SOFTWARE_APPLICATION_JSON_LD} />
      <Header currentPath="/pricing" />
      <main>
        <section id="pricing-hero" className="relative overflow-hidden">
          <PixelField
            variant="fade-down"
            seed={29}
            className="absolute inset-x-0 top-0 h-28 sm:h-36"
          />
          <div className={cn(shell, "relative pt-36 pb-14 sm:pt-44 sm:pb-20")}>
            <p className="font-mono text-xs text-muted-foreground">Pricing</p>
            <h1
              className={cn(
                display,
                "mt-5 max-w-6xl text-[clamp(3rem,9vw,8rem)] leading-[0.9]",
              )}
            >
              Start Free. Dig Deeper When You Need To.
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-pretty text-muted-foreground">
              Agent mode on your own machine is free. Upgrade for the strongest
              models, higher limits, file uploads, a bigger context window, or
              cloud agents.
            </p>
          </div>
        </section>

        <section
          id="plans"
          aria-labelledby="plans-heading"
          className={cn(shell, "pb-20 sm:pb-28")}
        >
          <PricingPlans />
        </section>

        <section
          id="billing"
          aria-labelledby="billing-heading"
          className="border-t border-white/15"
        >
          <div
            className={cn(
              shell,
              "grid gap-12 py-20 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-20",
            )}
          >
            <div className="relative pb-10">
              <h2
                id="billing-heading"
                className={cn(
                  display,
                  "text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.92]",
                )}
              >
                How Billing Works.
              </h2>
              <p className="mt-6 max-w-md text-lg leading-8 text-muted-foreground">
                One checkout, one portal for every change to your plan.
              </p>
              <CropMarks />
            </div>
            <RetroWindow title="billing.txt" bodyClassName="p-5 sm:p-7">
              <SpecList
                tone="paper"
                className="mt-0"
                items={[
                  [
                    "Merchant",
                    "Polar sells the paid plans. It runs checkout, tax, and receipts, and holds your payment details.",
                  ],
                  [
                    "Manage",
                    "Account settings → Payment → Manage opens Polar's customer portal to switch plans, update your card, see invoices, or cancel.",
                  ],
                  ["Free plan", "No payment method needed."],
                  [
                    "Execution",
                    "Local mode runs commands on your own machine. Cloud agents run in an isolated E2B sandbox.",
                  ],
                ]}
              />
              <Link href="/trust" className={cn(windowLink, focusOnPaper)}>
                Read Security &amp; Trust
              </Link>
            </RetroWindow>
          </div>
        </section>

        <section
          id="pricing-closing"
          aria-labelledby="pricing-closing-heading"
          className="border-t border-white/15"
        >
          <div className={cn(shell, "pt-20 pb-14 text-center sm:pt-28")}>
            <h2
              id="pricing-closing-heading"
              className={cn(
                display,
                "text-[clamp(2.25rem,6vw,5rem)] leading-[0.92]",
              )}
            >
              Not Sure Yet? Start on Free.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-pretty text-muted-foreground">
              You can upgrade from inside the app once a task needs more.
            </p>
            <div className="mt-10">
              <Link href="/signup" className={giantLink}>
                Create free account
              </Link>
            </div>
          </div>
          <PixelField variant="fade-up" seed={61} className="h-24 sm:h-32" />
        </section>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
