import type { Metadata } from "next";
import { DownloadPageContent } from "./DownloadPageContent";
import { canonicalMetadata } from "@/lib/seo/site";

export const metadata: Metadata = {
  ...canonicalMetadata("/download"),
  title: "Download | DiggerAI",
  description:
    "Use DiggerAI in the browser, add it to your phone's home screen, and connect your own machine with Remote Control.",
  openGraph: {
    title: "Download DiggerAI",
    description:
      "Use DiggerAI in the browser, add it to your phone's home screen, and connect your own machine with Remote Control.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Download DiggerAI",
    description:
      "Use DiggerAI in the browser, add it to your phone's home screen, and connect your own machine with Remote Control.",
  },
};

export default function DownloadPage() {
  return <DownloadPageContent />;
}
