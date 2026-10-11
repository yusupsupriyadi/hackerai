import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import Header from "@/app/components/Header";
import { PublicSiteFooter } from "@/components/public/PublicSiteFooter";
import { geistPixel } from "@/components/public/retro/fonts";
import { PixelField } from "@/components/public/retro/PixelField";
import { RetroWindow } from "@/components/public/retro/RetroWindow";
import { SpecList } from "@/components/public/retro/SpecList";
import { display, focusOnDark, shell } from "@/components/public/retro/styles";
import {
  PUBLIC_PAGE_LAST_MODIFIED,
  canonicalMetadata,
  formatPublicPageDate,
} from "@/lib/seo/site";
import { cn } from "@/lib/utils";

const description =
  "How DiggerAI handles your data: AI models, sandbox execution, storage, billing, and account security.";

export const metadata: Metadata = {
  ...canonicalMetadata("/trust"),
  title: "Security & Trust | DiggerAI",
  description,
  openGraph: {
    title: "Security & Trust | DiggerAI",
    description,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Security & Trust | DiggerAI",
    description,
  },
};

export const dynamic = "force-static";

const sections = [
  { id: "data", title: "Data We Process" },
  { id: "models", title: "AI Models and the Web" },
  { id: "execution", title: "Where Commands Run" },
  { id: "storage", title: "Where Data Is Stored" },
  { id: "account", title: "Account Security" },
  { id: "billing", title: "Billing" },
  { id: "deletion", title: "Deleting Your Data" },
  { id: "disclosure", title: "Reporting a Vulnerability" },
  { id: "compliance", title: "Compliance" },
] as const;

type SectionId = (typeof sections)[number]["id"];

const inlineLink = cn(
  "font-medium text-foreground underline underline-offset-4 hover:decoration-2",
  focusOnDark,
);

function TrustSection({
  id,
  children,
}: {
  id: SectionId;
  children: ReactNode;
}) {
  const index = sections.findIndex((section) => section.id === id);
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-8">
      <div className="flex items-baseline gap-4 border-t border-white/20 pt-6">
        <span
          aria-hidden="true"
          className={cn(
            geistPixel.className,
            "text-base text-muted-foreground",
          )}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <h2
          id={`${id}-heading`}
          className="text-3xl font-medium tracking-[-0.03em] sm:text-4xl"
        >
          {sections[index].title}
        </h2>
      </div>
      <div className="mt-6 space-y-4 text-lg leading-8 text-[#b3b3b3]">
        {children}
      </div>
    </section>
  );
}

function PixelList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-3">
          <span aria-hidden="true" className="mt-3 size-2 shrink-0 bg-white" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function TrustPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Header currentPath="/trust" />
      <main>
        <section id="trust-hero" className="relative overflow-hidden">
          <PixelField
            variant="fade-down"
            seed={43}
            className="absolute inset-x-0 top-0 h-28 sm:h-36"
          />
          <div className={cn(shell, "relative pt-36 pb-14 sm:pt-44 sm:pb-20")}>
            <p className="font-mono text-xs text-muted-foreground">
              Security &amp; Trust
            </p>
            <h1
              className={cn(
                display,
                "mt-5 max-w-6xl text-[clamp(3rem,9vw,8rem)] leading-[0.9]",
              )}
            >
              Where Your Data Goes.
            </h1>
            <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
              <p className="max-w-2xl text-lg leading-8 text-pretty text-muted-foreground">
                DiggerAI is an AI agent for penetration testing and security
                work. This page lists the data it processes, where agent
                commands run, and where that data is stored.
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                Last updated{" "}
                <time dateTime={PUBLIC_PAGE_LAST_MODIFIED.trust}>
                  {formatPublicPageDate(PUBLIC_PAGE_LAST_MODIFIED.trust)}
                </time>
              </p>
            </div>
          </div>
        </section>

        <div
          className={cn(
            shell,
            "grid gap-14 pb-24 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-20",
          )}
        >
          <nav
            aria-label="On this page"
            className="lg:sticky lg:top-8 lg:self-start"
          >
            <p
              className={cn(
                geistPixel.className,
                "inline-block bg-white px-2 py-0.5 text-sm text-black",
              )}
            >
              index.txt
            </p>
            <ol className="mt-4 grid grid-cols-1 gap-x-6 border-l border-white/30 sm:grid-cols-2 lg:grid-cols-1">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={cn(
                      focusOnDark,
                      "flex min-h-11 items-center gap-3 pl-4 text-sm text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(geistPixel.className, "text-base")}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="min-w-0 space-y-20">
            <TrustSection id="data">
              <p>Depending on how you use DiggerAI, the service processes:</p>
              <PixelList
                items={[
                  "Prompts and task messages you send to the agent",
                  "Files you upload (PDF, CSV, JSON, TXT, Markdown, DOC/DOCX, and PNG/JPEG/WebP/GIF images), including text extracted from them",
                  "URLs and search queries used when the agent browses or searches the web",
                  "Terminal commands and their output from agent sandbox sessions",
                  "Browser screenshots captured inside the agent sandbox",
                  "Notes and custom instructions you save",
                  "Account information such as your email address and name",
                ]}
              />
            </TrustSection>

            <TrustSection id="models">
              <p>
                Task requests go through InferHub, an OpenRouter-compatible
                gateway, to the provider behind the model you pick. Your prompt,
                the relevant conversation context, and tool results are sent to
                that provider so it can generate a response.
              </p>
              <p>
                When the agent searches the web or opens a URL, Firecrawl runs
                the search and fetches the page. OpenAI screens message content
                for moderation.
              </p>
              <p>
                Each provider handles data under its own terms, and whether data
                is used for training differs between them. We don&apos;t make a
                blanket promise about training, so check the policy of the
                provider behind your model.
              </p>
            </TrustSection>

            <TrustSection id="execution">
              <div className="grid gap-6 md:grid-cols-2">
                <RetroWindow
                  title="cloud: E2B sandbox"
                  tone="ink"
                  bodyClassName="p-5 text-base leading-7 sm:p-6"
                >
                  <p>
                    Cloud Agent sessions run terminal and browser actions in an
                    isolated E2B sandbox in E2B&apos;s US cluster. Delete your
                    sandboxes any time from Settings &rarr; Data controls.
                  </p>
                </RetroWindow>
                <RetroWindow
                  title="local: your machine"
                  bodyClassName="p-5 text-base leading-7 sm:p-6"
                >
                  <p>
                    DiggerAI Desktop and the Local Agent CLI run commands
                    directly on your machine with your user&apos;s privileges
                    and <strong>no isolation</strong>. Use them on a machine set
                    aside for testing.
                  </p>
                </RetroWindow>
              </div>
            </TrustSection>

            <TrustSection id="storage">
              <RetroWindow title="storage.txt" bodyClassName="p-5 sm:p-7">
                <SpecList
                  tone="paper"
                  className="mt-0"
                  items={[
                    [
                      "Database",
                      "Convex holds account data, tasks, messages, and settings.",
                    ],
                    [
                      "Files",
                      "Cloudflare R2 holds uploaded files and background task payloads. They are reached through signed links that expire.",
                    ],
                    [
                      "Run by us",
                      "Background agent runs (Trigger.dev), the live sandbox relay (Centrifugo), and stream resumption (Redis) run on infrastructure we operate, not on a third-party service.",
                    ],
                    [
                      "Regions",
                      "Requests are not routed by region. Every request uses the same database, the same storage, and E2B's US sandbox cluster.",
                    ],
                  ]}
                />
              </RetroWindow>
            </TrustSection>

            <TrustSection id="account">
              <PixelList
                items={[
                  "Sign-in runs on WorkOS AuthKit, so DiggerAI keeps no password database of its own",
                  <>
                    You can sign out of every device from Settings &rarr;
                    Security
                  </>,
                ]}
              />
            </TrustSection>

            <TrustSection id="billing">
              <p>
                Polar is the merchant of record for paid plans. It runs
                checkout, tax, and receipts, and holds your payment details, so
                card numbers never reach DiggerAI&apos;s servers. Switch plans,
                update your card, or cancel from Account settings &rarr; Payment
                &rarr; Manage, which opens Polar&apos;s customer portal.
              </p>
            </TrustSection>

            <TrustSection id="deletion">
              <PixelList
                items={[
                  "Delete individual tasks, or all tasks at once",
                  "Delete your cloud sandboxes",
                  "Revoke links to tasks you have shared",
                  "Delete your account, which removes your database records and your sign-in record",
                  "Deleting your account does not cancel a Polar subscription, so cancel your plan in the customer portal first",
                  "Deleting and recreating an account does not reset usage limits or referral eligibility",
                ]}
              />
            </TrustSection>

            <TrustSection id="disclosure">
              <p>
                A dedicated security contact for DiggerAI isn&apos;t set up yet.
                Until it is, please don&apos;t publish details of a
                vulnerability you find.
              </p>
            </TrustSection>

            <TrustSection id="compliance">
              <p>
                DiggerAI doesn&apos;t hold SOC 2, ISO 27001, or any other
                third-party certification. The{" "}
                <Link href="/privacy-policy" className={inlineLink}>
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link href="/terms-of-service" className={inlineLink}>
                  Terms of Service
                </Link>{" "}
                cover the rest. We&apos;ll update this page if that changes.
              </p>
            </TrustSection>
          </div>
        </div>

        <PixelField variant="fade-up" seed={71} className="h-24 sm:h-32" />
      </main>
      <PublicSiteFooter />
    </div>
  );
}
