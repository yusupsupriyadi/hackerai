import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import Header from "@/app/components/Header";
import { HackerAISVG } from "@/components/icons/hackerai-svg";
import { PublicSiteFooter } from "@/components/public/PublicSiteFooter";
import { CropMarks } from "@/components/public/retro/CropMarks";
import { geistPixel } from "@/components/public/retro/fonts";
import { PixelField } from "@/components/public/retro/PixelField";
import { RetroWindow } from "@/components/public/retro/RetroWindow";
import { SpecList } from "@/components/public/retro/SpecList";
import {
  chip,
  display,
  focusOnDark,
  focusOnPaper,
  giantHeading,
  giantLink,
  shell,
  windowLink,
} from "@/components/public/retro/styles";
import { ZoomableImage } from "@/components/public/ZoomableImage";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  SOFTWARE_APPLICATION_JSON_LD,
  canonicalMetadata,
} from "@/lib/seo/site";
import { cn } from "@/lib/utils";

import { GlitchMark } from "./GlitchMark";

const description =
  "See how DiggerAI combines security-focused AI, Agent mode, terminal and browser tools, files, and local or cloud execution for penetration testing.";

export const metadata: Metadata = {
  ...canonicalMetadata("/product"),
  title: "Product | DiggerAI",
  description,
  openGraph: {
    title: "DiggerAI Product",
    description,
    type: "website",
    url: "/product",
    images: ["/images/hackerai-workspace.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "DiggerAI Product",
    description,
    images: ["/images/hackerai-workspace.png"],
  },
};

export const dynamic = "force-static";

const loopTools = [
  {
    title: "Terminal",
    copy: "Runs the commands and shows the output as it came back, not a summary of it.",
    placement: "lg:col-start-1 lg:row-start-1 lg:mt-40 lg:self-start",
  },
  {
    title: "Browser",
    copy: "Opens the pages a task needs, in the same loop as the terminal.",
    placement: "lg:col-start-10 lg:row-start-1 lg:mt-28 lg:self-start",
  },
  {
    title: "Files",
    copy: "Reports, screenshots, source, and data you drop in. It works from those instead of guessing at your environment.",
    placement: "lg:col-start-1 lg:row-start-3 lg:mb-10 lg:self-end",
  },
  {
    title: "Findings",
    copy: "Commands, output, notes, and findings stay attached to the task.",
    placement: "lg:col-start-10 lg:row-start-3 lg:self-end",
  },
] as const;

const modes = [
  { label: "Ask", copy: "Focused analysis of the question in front of you." },
  {
    label: "Agent",
    copy: "Plans and runs multi-step work with the tools it needs.",
  },
  {
    label: "Context",
    copy: "The more context you give it, the further it gets.",
  },
] as const;

// Mirrors the options in AgentPermissionSelector.
const permissionModes = [
  {
    label: "Ask for approval",
    description: "Always ask before commands and file changes.",
  },
  {
    label: "Approve for me",
    description: "Only ask for actions detected as potentially unsafe.",
  },
  {
    label: "Full access",
    description: "Run commands and edit files without asking.",
  },
] as const;

function RuledColumn({
  label,
  children,
  large = false,
}: {
  label: string;
  children: ReactNode;
  large?: boolean;
}) {
  return (
    <div className="border-l border-white/40 pl-4 sm:pl-5">
      <h3 className="font-mono text-xs text-muted-foreground">{label}</h3>
      <p
        className={cn(
          "mt-6 text-pretty",
          large
            ? "text-2xl leading-[1.25] tracking-[-0.015em] sm:text-[1.75rem]"
            : "text-lg leading-7",
        )}
      >
        {children}
      </p>
    </div>
  );
}

function SignupLinks() {
  return (
    <div className="mt-12 flex flex-col items-center gap-5 sm:mt-16 sm:flex-row sm:justify-center sm:gap-16">
      <Link href="/signup" className={giantLink}>
        Create free account
      </Link>
      <Link href="/pricing" className={giantLink}>
        See pricing
      </Link>
    </div>
  );
}

export default function ProductPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <JsonLd data={SOFTWARE_APPLICATION_JSON_LD} />
      <Header currentPath="/product" />
      <main>
        <section id="product-hero" className="relative overflow-hidden">
          <PixelField
            variant="fade-down"
            seed={11}
            clearRadius={110}
            className="absolute inset-x-0 top-0 h-[22rem] sm:h-[30rem]"
          />
          <div className={cn(shell, "relative pt-6 pb-20 sm:pt-8 sm:pb-28")}>
            <div className="relative">
              <GlitchMark className="h-[18rem] w-full sm:h-[26rem] lg:h-[30rem]" />
              <RetroWindow
                title="DiggerAI: new task"
                className="relative mx-auto -mt-4 max-w-md lg:absolute lg:right-0 lg:bottom-4 lg:mt-0 lg:w-[22rem]"
                bodyClassName="px-5 py-5 text-center lg:text-left"
              >
                <p className="text-base leading-7 text-pretty">
                  Point it at a target. It runs the recon, the tools, and keeps
                  the evidence. On your machine or in an isolated cloud sandbox.
                </p>
                <a
                  href="#where-it-runs"
                  className={cn(windowLink, focusOnPaper, "mt-2 text-sm")}
                >
                  Local or cloud, per task
                </a>
              </RetroWindow>
            </div>

            <p className="mx-auto mt-14 flex max-w-2xl flex-wrap items-baseline justify-center gap-x-3 text-center text-base font-medium sm:mt-24 sm:flex-nowrap sm:text-lg">
              <span className="shrink-0">Built for</span>
              <span
                aria-hidden="true"
                className="hidden min-w-12 flex-1 border-b-2 border-dotted border-white/70 sm:block"
              />
              <span>pentesters and bug bounty hunters</span>
            </p>
            <h1
              className={cn(
                display,
                "mx-auto mt-6 text-center text-[clamp(3rem,10.5vw,10rem)] leading-[0.86]",
              )}
            >
              The AI Agent for Penetration Testing.
            </h1>
            <SignupLinks />
            <p className="mt-6 text-center font-mono text-xs text-muted-foreground">
              Free needs no payment method.
            </p>
          </div>
        </section>

        <section
          id="tools-in-the-loop"
          aria-labelledby="tools-heading"
          className={cn(shell, "pb-20 sm:pb-28")}
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2
              id="tools-heading"
              className="text-3xl font-medium tracking-[-0.03em] sm:text-4xl"
            >
              Real Tools. Raw Output.
            </h2>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              A terminal and a browser are in the loop. What they return stays
              in the task.
            </p>
          </div>
          <div className="relative mt-6 overflow-hidden border border-white/30 p-4 sm:p-6 lg:p-10">
            <PixelField
              variant="blobs"
              seed={23}
              className="absolute inset-0"
            />
            <p className={chip}>DIGGER.OS</p>
            <div className="relative mt-8 grid gap-5 md:grid-cols-2 lg:mt-4 lg:grid-cols-12">
              <RetroWindow
                title="Agent mode: recon task"
                tone="ink"
                className="md:col-span-2 lg:col-span-8 lg:col-start-3 lg:row-span-3 lg:row-start-1 lg:my-16 lg:self-center"
              >
                <ZoomableImage
                  src="/images/hackerai-workspace.png"
                  alt="DiggerAI Agent mode running recon on a target: a to-do plan, reasoning, and commands executing in the task"
                  width={2240}
                  height={1400}
                  priority
                  frameClassName="focus-visible:ring-white"
                />
              </RetroWindow>
              {loopTools.map((tool) => (
                <RetroWindow
                  key={tool.title}
                  title={tool.title}
                  className={cn("relative z-10 lg:col-span-3", tool.placement)}
                  bodyClassName="p-4"
                >
                  <p className="text-sm leading-6">{tool.copy}</p>
                </RetroWindow>
              ))}
            </div>
          </div>
        </section>

        <section id="proof-is-the-job" aria-labelledby="proof-heading">
          <div className={cn(shell, "py-20 sm:pt-28 sm:pb-32")}>
            <div className="relative pb-10 sm:pb-14">
              <h2
                id="proof-heading"
                className={cn(
                  display,
                  giantHeading,
                  "mx-auto max-w-6xl text-center",
                )}
              >
                Findings Are Cheap. Proof Is the Job.
              </h2>
              <CropMarks />
            </div>
            <div className="mt-14 grid gap-12 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem] lg:gap-16">
              <RuledColumn label="Not a scanner" large>
                Scanners produce lists. Pentesters, bug bounty hunters, and red
                teams need reproducible evidence and a write-up that holds up.
              </RuledColumn>
              <RuledColumn label="One task, end to end" large>
                DiggerAI keeps the whole engagement in one task, from first scan
                to final report. Every claim in your write-up points back to
                what actually ran.
              </RuledColumn>
              <div aria-hidden="true" className="hidden lg:block">
                <p className="font-mono text-xs text-muted-foreground">
                  [DiggerAI.mark]
                </p>
                <div className="mt-6">
                  <HackerAISVG theme="dark" scale={0.9} />
                </div>
              </div>
            </div>
            <div className="mt-16 grid gap-10 sm:grid-cols-3 lg:mt-24 lg:max-w-5xl">
              {modes.map((mode) => (
                <RuledColumn key={mode.label} label={mode.label}>
                  {mode.copy}
                </RuledColumn>
              ))}
            </div>
          </div>
        </section>

        <section id="where-it-runs" aria-labelledby="runs-heading">
          <div className={cn(shell, "py-20 sm:py-28")}>
            <div className="relative grid gap-8 pb-10 sm:pb-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:gap-16">
              <h2 id="runs-heading" className={cn(display, giantHeading)}>
                Full Control, Wherever It Runs.
              </h2>
              <p className="max-w-xl text-lg leading-8 text-muted-foreground">
                Local or cloud, per task. You define the environment and how
                much the agent may do on its own.
              </p>
              <CropMarks />
            </div>
            <div className="mt-14 grid gap-6 lg:grid-cols-2 lg:gap-10">
              <RetroWindow
                title="Local: DiggerAI Desktop or Local Agent CLI"
                bodyClassName="p-5 sm:p-7"
              >
                <p className="text-lg leading-8 text-pretty">
                  DiggerAI Desktop and the Local Agent CLI connect Agent mode to
                  your own toolchain.
                </p>
                <SpecList
                  tone="paper"
                  items={[
                    ["Runs as", "Your user, with your user's privileges"],
                    [
                      "Isolation",
                      "None. Use a dedicated testing box you control.",
                    ],
                    [
                      "Starts",
                      "Only after you connect DiggerAI Desktop or the CLI",
                    ],
                  ]}
                />
              </RetroWindow>
              <RetroWindow
                title="Cloud: isolated sandbox"
                tone="ink"
                bodyClassName="p-5 sm:p-7"
              >
                <p className="text-lg leading-8 text-pretty">
                  Cloud Agent sessions run terminal and browser actions in an
                  isolated sandbox we host.
                </p>
                <SpecList
                  tone="ink"
                  items={[
                    ["Runs in", "An isolated sandbox we host"],
                    ["Delete", "Whenever you like, from Settings"],
                    [
                      "Processing",
                      "What we process, and who processes it, is on the Security & Trust page",
                    ],
                  ]}
                />
                <Link href="/trust" className={cn(windowLink, focusOnDark)}>
                  Read Security &amp; Trust
                </Link>
              </RetroWindow>
            </div>
          </div>
        </section>

        <section id="guardrails" aria-labelledby="guardrails-heading">
          <div
            className={cn(
              shell,
              "grid gap-12 py-20 sm:py-28 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:gap-20",
            )}
          >
            <div className="relative overflow-hidden border border-white/30 px-4 pt-14 pb-10 sm:px-10 sm:pt-20 sm:pb-16">
              <PixelField
                variant="blobs"
                seed={41}
                className="absolute inset-0"
              />
              <p className={chip}>Agent.Permissions</p>
              <RetroWindow
                title="Permission level"
                className="relative mx-auto max-w-lg"
              >
                <ul className="divide-y divide-black/20">
                  {permissionModes.map((mode) => (
                    <li key={mode.label} className="flex gap-3 px-5 py-4">
                      <span
                        aria-hidden="true"
                        className="mt-2 size-2.5 shrink-0 bg-black"
                      />
                      <div>
                        <p
                          className={cn(
                            geistPixel.className,
                            "text-lg leading-6",
                          )}
                        >
                          {mode.label}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#3d3d3d]">
                          {mode.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </RetroWindow>
            </div>
            <div>
              <p className="font-mono text-xs text-muted-foreground">
                Per task
              </p>
              <h2
                id="guardrails-heading"
                className={cn(
                  display,
                  "mt-5 text-[clamp(2.25rem,5vw,4.5rem)] leading-[0.92]",
                )}
              >
                You Set the Guardrails.
              </h2>
              <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
                Pick a permission level per task. Change it any time from the
                task input.
              </p>
            </div>
          </div>
        </section>

        <section id="read-me" aria-labelledby="readme-heading">
          <div className={cn(shell, "py-20 sm:py-28")}>
            <div className="relative pb-10 sm:pb-14">
              <h2
                id="readme-heading"
                className={cn(display, giantHeading, "text-center")}
              >
                Proof, Not Promises.
              </h2>
              <CropMarks />
            </div>
            <div className="relative mt-14 overflow-hidden border border-white/30 px-4 pt-14 pb-10 sm:px-10 sm:pt-20 sm:pb-16">
              <PixelField
                variant="blobs"
                seed={67}
                className="absolute inset-0"
              />
              <p className={chip}>Limits</p>
              <RetroWindow
                title="ReadMe.txt"
                className="relative mx-auto max-w-3xl"
                bodyClassName="px-5 py-6 sm:px-10 sm:py-10"
              >
                <p className="text-xl leading-8 text-pretty sm:text-2xl sm:leading-9">
                  DiggerAI speeds up security work. It does not replace your
                  judgment, your authorization, or your validation.
                </p>
                <dl className="mt-8 grid gap-8 border-t border-black/25 pt-6 sm:grid-cols-2">
                  <div>
                    <dt className="font-mono text-xs text-[#3d3d3d]">
                      You validate. It assists.
                    </dt>
                    <dd className="mt-2 leading-7">
                      AI output and tool actions can be incomplete or wrong.
                      Confirm evidence and impact before you report or act on
                      it.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-xs text-[#3d3d3d]">
                      Plans set the limits.
                    </dt>
                    <dd className="mt-2 leading-7">
                      Model access, included usage, files, context, and
                      cloud-agent capacity depend on your plan and current
                      availability.
                    </dd>
                    <dd>
                      <Link
                        href="/pricing"
                        className={cn(windowLink, focusOnPaper, "mt-1 text-sm")}
                      >
                        Compare plans
                      </Link>
                    </dd>
                  </div>
                </dl>
              </RetroWindow>
            </div>
          </div>
        </section>

        <section id="platforms" aria-labelledby="platforms-heading">
          <div
            className={cn(
              shell,
              "grid gap-12 py-20 sm:py-28 md:grid-cols-[minmax(0,1fr)_16rem] md:items-center lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-20",
            )}
          >
            <div>
              <h2 id="platforms-heading" className={cn(display, giantHeading)}>
                Web, Desktop, and Mobile.
              </h2>
              <p className="mt-8 max-w-xl text-lg leading-8 text-muted-foreground">
                Start a task in the browser. Install DiggerAI Desktop when you
                want to connect local tools. Pick up the same task on your phone
                from the mobile web app.
              </p>
              <Link
                href="/download"
                className={cn(
                  focusOnDark,
                  "mt-8 inline-flex min-h-11 items-center text-2xl font-medium tracking-[-0.02em] underline decoration-2 underline-offset-[0.2em] hover:decoration-4",
                )}
              >
                See all downloads
              </Link>
            </div>
            <RetroWindow
              title="Mobile web"
              tone="ink"
              className="mx-auto w-full max-w-[18rem] md:max-w-none"
            >
              <ZoomableImage
                src="/images/hackerai-mobile.png"
                alt="DiggerAI mobile web app running the same recon task on a phone"
                width={780}
                height={1688}
                frameClassName="focus-visible:ring-white"
              />
            </RetroWindow>
          </div>
        </section>

        <section id="next-target" aria-labelledby="closing-heading">
          <div className={cn(shell, "pt-20 pb-12 sm:pt-28")}>
            <h2
              id="closing-heading"
              className={cn(display, giantHeading, "text-center")}
            >
              Point It at Your Next Target.
            </h2>
            <p className="mx-auto mt-8 max-w-xl text-center text-lg leading-8 text-pretty text-muted-foreground">
              No setup to speak of. Sign up, pick your target, and run your
              first task in the browser.
            </p>
            <SignupLinks />
            <div className="mt-20 flex flex-col gap-3 border-t border-white/15 pt-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
              <p>
                Read how DiggerAI handles your data and what each plan includes.
              </p>
              <ul className="flex flex-wrap gap-x-6">
                <li>
                  <Link
                    href="/trust"
                    className={cn(
                      focusOnDark,
                      "inline-flex min-h-11 items-center font-medium text-foreground hover:underline hover:underline-offset-4",
                    )}
                  >
                    Security &amp; Trust
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pricing"
                    className={cn(
                      focusOnDark,
                      "inline-flex min-h-11 items-center font-medium text-foreground hover:underline hover:underline-offset-4",
                    )}
                  >
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <PixelField variant="fade-up" seed={57} className="h-28 sm:h-36" />
        </section>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
