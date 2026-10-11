import { cn } from "@/lib/utils";

import { geistPixel } from "./fonts";

// Shared class recipes for the retro OS public pages (product, pricing, trust).
export const shell = "mx-auto w-full max-w-[96rem] px-4 sm:px-6 lg:px-10";
export const display = "font-medium tracking-[-0.045em] text-balance";
export const giantHeading = "text-[clamp(2.5rem,8.5vw,7.5rem)] leading-[0.92]";
export const focusOnDark =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";
export const focusOnPaper =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";
export const giantLink = cn(
  "inline-block text-[clamp(1.875rem,5vw,4.25rem)] leading-[1.1] font-medium tracking-[-0.04em] underline decoration-[0.06em] underline-offset-[0.16em] transition-[text-decoration-thickness] duration-150 hover:decoration-[0.14em]",
  focusOnDark,
);
export const windowLink =
  "mt-6 inline-flex min-h-11 items-center gap-2 font-medium underline decoration-1 underline-offset-4 hover:decoration-2";
/** Label pinned to the top-left corner of a dithered panel. */
export const chip = cn(
  geistPixel.className,
  "absolute top-0 left-0 bg-white px-2 py-0.5 text-sm leading-5 text-black",
);
