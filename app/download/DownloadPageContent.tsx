"use client";

import Header from "@/app/components/Header";
import { PublicSiteFooter } from "@/components/public/PublicSiteFooter";
import { display, shell } from "@/components/public/retro/styles";
import { cn } from "@/lib/utils";
import { DownloadSection, useDetectedPlatform } from "./DownloadSection";

function DownloadContent() {
  const detected = useDetectedPlatform();
  const isMobile =
    detected?.platform === "ios" || detected?.platform === "android";

  return (
    <div className={cn(shell, "max-w-4xl py-20 sm:py-28")}>
      <p className="font-mono text-xs text-muted-foreground">Download</p>
      <h1
        className={cn(
          display,
          "mt-5 text-[clamp(3rem,9vw,7rem)] leading-[0.9]",
        )}
      >
        {isMobile ? "Install DiggerAI." : "Get DiggerAI."}
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-pretty text-muted-foreground">
        {isMobile
          ? "Add DiggerAI to your home screen to open it like a native app."
          : "DiggerAI runs in the browser. Remote Control in Settings connects your own machine to Agent mode."}
      </p>
      <div className="mt-12">
        <DownloadSection />
      </div>
    </div>
  );
}

export function DownloadPageContent() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <Header currentPath="/download" />
      <main className="flex-1">
        <DownloadContent />
      </main>
      <PublicSiteFooter />
    </div>
  );
}
