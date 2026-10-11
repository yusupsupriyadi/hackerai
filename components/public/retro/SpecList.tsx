import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Ruled term/detail rows for the inside of a RetroWindow body. */
export function SpecList({
  items,
  tone,
  className,
}: {
  items: ReadonlyArray<readonly [string, ReactNode]>;
  tone: "paper" | "ink";
  className?: string;
}) {
  return (
    <dl className={cn("mt-6", className)}>
      {items.map(([term, detail]) => (
        <div
          key={term}
          className={cn(
            "grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 border-t py-3",
            tone === "paper" ? "border-black/25" : "border-white/20",
          )}
        >
          <dt
            className={cn(
              "font-mono text-xs leading-6",
              tone === "paper" ? "text-[#3d3d3d]" : "text-muted-foreground",
            )}
          >
            {term}
          </dt>
          <dd className="text-sm leading-6">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}
