import Link from "next/link";

import { HackerAISVG } from "@/components/icons/hackerai-svg";
import { geistPixel } from "@/components/public/retro/fonts";
import { focusOnDark, shell } from "@/components/public/retro/styles";
import { cn } from "@/lib/utils";

type FooterLink = { href: string; label: string };

const links: readonly FooterLink[] = [
  { href: "/product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/download", label: "Download" },
  { href: "/trust", label: "Security & Trust" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-of-service", label: "Terms of Service" },
];

const linkClassName = cn(
  focusOnDark,
  "inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground",
);

export function PublicSiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer id="site-footer" className="border-t border-white/15">
      <div
        className={cn(
          shell,
          "grid gap-12 pt-14 pb-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end",
        )}
      >
        <Link
          href="/"
          aria-label="DiggerAI home"
          className={cn(focusOnDark, "inline-flex items-end gap-4 self-start")}
        >
          <HackerAISVG theme="dark" scale={0.32} />
          <span className="text-[clamp(3rem,9vw,7rem)] leading-[0.8] font-medium tracking-[-0.05em]">
            DiggerAI
          </span>
        </Link>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-10 sm:grid-cols-3 md:grid-cols-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkClassName}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div
        className={cn(
          shell,
          "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-white/15 py-5",
        )}
      >
        <p
          className={cn(geistPixel.className, "text-sm text-muted-foreground")}
        >
          &copy; {year} DiggerAI
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          The AI agent for penetration testing
        </p>
      </div>
    </footer>
  );
}
