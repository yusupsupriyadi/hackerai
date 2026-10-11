import type { Metadata } from "next";
import { PRICING } from "@/lib/pricing/config";

export const SITE_NAME = "DiggerAI";
export const SITE_URL = "https://hackerai.co";
export const SITE_DESCRIPTION =
  "DiggerAI is an AI agent for penetration testing that helps security practitioners investigate targets, use terminal and browser tools, analyze findings, and prepare reports.";
// The logo is served by this deployment; SITE_URL still points at hackerai.co,
// which hosts the upstream HackerAI logo.
export const SITE_LOGO_URL = new URL(
  "/icon-512x512.png",
  process.env.NEXT_PUBLIC_BASE_URL || SITE_URL,
).toString();
export const SITE_SCREENSHOT_URL = `${SITE_URL}/images/hackerai-workspace.png`;
export const GITHUB_URL = "https://github.com/hackerai-tech/hackerai";
export const HELP_CENTER_URL = "https://help.hackerai.co/en/";
export const LOCAL_AGENT_HELP_URL =
  "https://help.hackerai.co/en/articles/12961920-connecting-a-hackerai-agent-to-your-local-machine";
export const EXTRA_USAGE_HELP_URL =
  "https://help.hackerai.co/en/articles/13455916-extra-usage-for-paid-hackerai-plans";
export const CANCELLATION_HELP_URL =
  "https://help.hackerai.co/en/articles/14053370-how-do-i-cancel-my-hackerai-subscription";
export const REFUND_HELP_URL =
  "https://help.hackerai.co/en/articles/12242991-how-do-i-request-a-refund-for-my-hackerai-subscription";
export const STATUS_PAGE_URL = "https://status.hackerai.co/";

export const PUBLIC_PAGE_LAST_MODIFIED = {
  home: "2026-09-02",
  product: "2026-10-12",
  pricing: "2026-10-12",
  download: "2026-10-12",
  trust: "2026-10-12",
  privacy: "2026-10-12",
  terms: "2026-10-12",
} as const;

export function formatPublicPageDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function canonicalMetadata(
  path: `/${string}` | "/",
): Pick<Metadata, "alternates"> {
  return {
    alternates: {
      canonical: path,
    },
  };
}

export const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  legalName: "DiggerAI",
  url: SITE_URL,
  logo: {
    "@type": "ImageObject",
    url: SITE_LOGO_URL,
    width: 512,
    height: 512,
  },
} as const;

export const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  publisher: {
    "@id": `${SITE_URL}/#organization`,
  },
} as const;

const PAID_PLAN_OFFERS = (
  [
    ["pro", "DiggerAI Pro"],
    ["pro-plus", "DiggerAI Pro+"],
    ["ultra", "DiggerAI Ultra"],
    ["team", "DiggerAI Team (per seat)"],
  ] as const
).map(([key, name]) => ({
  "@type": "Offer",
  name,
  price: String(PRICING[key].monthly),
  priceCurrency: "USD",
  url: `${SITE_URL}/pricing`,
  priceSpecification: {
    "@type": "UnitPriceSpecification",
    price: String(PRICING[key].monthly),
    priceCurrency: "USD",
    billingDuration: "P1M",
  },
}));

export const SOFTWARE_APPLICATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/product#software-application`,
  name: SITE_NAME,
  url: `${SITE_URL}/product`,
  description: SITE_DESCRIPTION,
  applicationCategory: "SecurityApplication",
  applicationSubCategory: "Penetration testing assistant",
  operatingSystem: "Web, macOS, Windows, Linux, iOS, Android",
  image: SITE_SCREENSHOT_URL,
  dateModified: PUBLIC_PAGE_LAST_MODIFIED.product,
  publisher: {
    "@id": `${SITE_URL}/#organization`,
  },
  offers: [
    {
      "@type": "Offer",
      name: "DiggerAI Free",
      price: "0",
      priceCurrency: "USD",
      url: `${SITE_URL}/pricing`,
    },
    ...PAID_PLAN_OFFERS,
  ],
} as const;
