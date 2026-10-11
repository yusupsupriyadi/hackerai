import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { geistPixel } from "./fonts";
import { PixelField } from "./PixelField";

// Gives each window its own dither pattern without passing a seed around.
function titleSeed(title: string) {
  let seed = 0;
  for (const char of title) seed = (seed * 31 + char.charCodeAt(0)) | 0;
  return seed;
}

interface RetroWindowProps {
  title: string;
  children: ReactNode;
  /** Paper bodies read as light documents; ink bodies stay on the dark canvas. */
  tone?: "paper" | "ink";
  className?: string;
  bodyClassName?: string;
}

/** Square-cornered window chrome with a bitmap title bar. Purely presentational. */
export function RetroWindow({
  title,
  children,
  tone = "paper",
  className,
  bodyClassName,
}: RetroWindowProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col border border-white bg-black p-0.5",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-2 pt-0.5 pb-1">
        <p
          className={cn(
            geistPixel.className,
            "min-w-0 truncate text-sm leading-5 text-white",
          )}
        >
          {title}
        </p>
        {/* Moving dither where a classic title bar has stripes. */}
        <PixelField
          variant="band"
          seed={titleSeed(title)}
          cell={2}
          className="h-2.5 min-w-8 flex-1"
        />
      </div>
      <div
        className={cn(
          "flex-1 border",
          tone === "paper"
            ? "border-black bg-[#e4e4e4] text-black"
            : "border-white/40 bg-[#0b0b0b] text-white",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
