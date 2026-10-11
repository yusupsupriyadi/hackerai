"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";

import { geistPixel } from "@/components/public/retro/fonts";
import { PixelField } from "@/components/public/retro/PixelField";
import { RetroWindow } from "@/components/public/retro/RetroWindow";
import {
  chip,
  focusOnDark,
  focusOnPaper,
} from "@/components/public/retro/styles";
import { cn } from "@/lib/utils";
import {
  PLAN_HEADERS,
  PRICING,
  freeFeatures,
  proFeatures,
  proPlusFeatures,
  ultraFeatures,
} from "@/lib/pricing/features";

type BillingFrequency = "monthly" | "yearly";

const frequencies: ReadonlyArray<{ value: BillingFrequency; label: string }> = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

// Team and Extra Usage are Stripe-only; the self-hosted build sells through Polar.
const plans = [
  {
    key: "free",
    name: "Free",
    file: "free.plan",
    description: "Try Agent mode on your own machine",
    features: freeFeatures,
    featureHeader: PLAN_HEADERS.free,
  },
  {
    key: "pro",
    name: "Pro",
    file: "pro.plan",
    description: "For steady engagement work",
    features: proFeatures,
    featureHeader: PLAN_HEADERS.pro,
  },
  {
    key: "pro-plus",
    name: "Pro+",
    file: "pro-plus.plan",
    description: "For heavier weekly workloads",
    features: proPlusFeatures,
    featureHeader: PLAN_HEADERS["pro-plus"],
  },
  {
    key: "ultra",
    name: "Ultra",
    file: "ultra.plan",
    description: "For all-day, every-day testing",
    features: ultraFeatures,
    featureHeader: PLAN_HEADERS.ultra,
  },
] as const;

/** Mirrors the plan highlighted in the in-app pricing dialog. */
const RECOMMENDED_PLAN = "pro-plus";

function billingNote(frequency: BillingFrequency) {
  return frequency === "yearly" ? "Per month, billed yearly" : "Billed monthly";
}

function FrequencyToggle({
  value,
  onChange,
}: {
  value: BillingFrequency;
  onChange: (value: BillingFrequency) => void;
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  // Radio group keyboard pattern: arrows move the selection and the focus.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    const nextIndex = value === "monthly" ? 1 : 0;
    onChange(frequencies[nextIndex].value);
    buttons.current[nextIndex]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Billing period"
      onKeyDown={onKeyDown}
      className="inline-flex border border-white p-0.5"
    >
      {frequencies.map((frequency, index) => {
        const checked = frequency.value === value;
        return (
          <button
            key={frequency.value}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(frequency.value)}
            className={cn(
              geistPixel.className,
              focusOnDark,
              "min-h-11 px-5 text-base",
              checked ? "bg-white text-black" : "text-white hover:bg-white/10",
            )}
          >
            {frequency.label}
          </button>
        );
      })}
    </div>
  );
}

export function PricingPlans() {
  const [frequency, setFrequency] = useState<BillingFrequency>("monthly");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2
            id="plans-heading"
            className="text-3xl font-medium tracking-[-0.03em] sm:text-4xl"
          >
            Individual Plans
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Prices in USD. Switch plans or cancel whenever you like from account
            settings.
          </p>
        </div>
        <FrequencyToggle value={frequency} onChange={setFrequency} />
      </div>

      <div className="relative mt-6 overflow-hidden border border-white/30 p-4 pt-12 sm:p-6 sm:pt-14 lg:p-10 lg:pt-14">
        <PixelField variant="blobs" seed={31} className="absolute inset-0" />
        <p className={chip}>DIGGER.OS/plans</p>
        <ul className="relative grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const price =
              plan.key === "free" ? 0 : PRICING[plan.key][frequency];
            const recommended = plan.key === RECOMMENDED_PLAN;
            const tone = recommended ? "paper" : "ink";
            const muted = recommended
              ? "text-[#3d3d3d]"
              : "text-muted-foreground";

            return (
              <li key={plan.key} className="flex">
                <article
                  aria-labelledby={`plan-${plan.key}`}
                  className="flex w-full"
                >
                  <RetroWindow
                    title={plan.file}
                    tone={tone}
                    className="w-full"
                    bodyClassName="flex flex-col p-5 sm:p-6"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h3
                        id={`plan-${plan.key}`}
                        className="text-2xl font-medium tracking-[-0.02em]"
                      >
                        {plan.name}
                      </h3>
                      {recommended ? (
                        <p className={cn(geistPixel.className, "text-sm")}>
                          recommended
                        </p>
                      ) : null}
                    </div>
                    <p className={cn("mt-2 min-h-10 text-sm leading-5", muted)}>
                      {plan.description}
                    </p>
                    <p className="mt-6 flex items-end gap-1.5">
                      <span className="text-6xl leading-none font-medium tracking-[-0.04em]">
                        ${price}
                      </span>
                      <span className={cn("pb-1 text-sm", muted)}>/ month</span>
                    </p>
                    <p
                      className={cn("mt-3 font-mono text-xs leading-5", muted)}
                    >
                      {plan.key === "free"
                        ? "No payment method required"
                        : billingNote(frequency)}
                    </p>
                    <Link
                      href="/signup"
                      className={cn(
                        "mt-6 inline-flex min-h-11 w-full items-center justify-center px-4 font-medium",
                        recommended
                          ? cn(
                              "bg-black text-white hover:bg-black/80",
                              focusOnPaper,
                            )
                          : cn(
                              "bg-white text-black hover:bg-white/80",
                              focusOnDark,
                            ),
                      )}
                    >
                      {plan.key === "free"
                        ? "Start free"
                        : `Choose ${plan.name}`}
                    </Link>
                    {plan.featureHeader ? (
                      <p className="mt-7 text-sm font-medium">
                        {plan.featureHeader}
                      </p>
                    ) : null}
                    <ul
                      className={cn(
                        "space-y-3 text-sm",
                        plan.featureHeader ? "mt-3" : "mt-7",
                      )}
                    >
                      {plan.features.map((feature) => (
                        <li
                          key={feature.text}
                          className="flex items-start gap-3"
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "mt-1.5 size-2 shrink-0",
                              recommended ? "bg-black" : "bg-white",
                            )}
                          />
                          <span className={muted}>{feature.text}</span>
                        </li>
                      ))}
                    </ul>
                  </RetroWindow>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
