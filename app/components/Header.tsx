"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { HackerAISVG } from "@/components/icons/hackerai-svg";
import { geistPixel } from "@/components/public/retro/fonts";
import { cn } from "@/lib/utils";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { navigateToAuth } from "@/app/hooks/useTauri";

const publicNavigation = [
  { href: "/product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/download", label: "Download" },
  { href: "/trust", label: "Trust" },
] as const;

export type PublicNavigationPath = (typeof publicNavigation)[number]["href"];

interface HeaderProps {
  chatTitle?: string;
  /** Path of the public page rendering the header, used to mark the current link. */
  currentPath?: PublicNavigationPath;
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
// Menu-bar items: the current page is shown inverted, like a selected menu in a classic OS.
const menuItem = (isCurrent: boolean) =>
  cn(
    geistPixel.className,
    focusRing,
    "inline-flex h-9 items-center px-3 text-base",
    isCurrent
      ? "bg-white text-black"
      : "text-white/75 hover:bg-white/10 hover:text-white",
  );
const outlineButton = cn(
  focusRing,
  "inline-flex h-9 items-center border border-white px-3 text-sm font-medium text-white hover:bg-white/10 max-md:h-11",
);
const solidButton = cn(
  focusRing,
  "inline-flex h-9 items-center bg-white px-3 text-sm font-medium text-black hover:bg-white/85 max-md:h-11",
);

const startSignUp = () =>
  navigateToAuth("/signup", { preferSignInForReturningUser: true });

const Header: React.FC<HeaderProps> = ({ chatTitle, currentPath }) => {
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const [menuTop, setMenuTop] = useState(0);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // The open menu sits directly under the (unchanged) header, so measure where the header ends.
  useLayoutEffect(() => {
    if (!menuOpen) return;
    const update = () => {
      const rect = headerRef.current?.getBoundingClientRect();
      setMenuTop(rect ? Math.max(0, rect.bottom) : 0);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, closeMenu]);

  const signedOut = !loading && !user;

  return (
    <header
      ref={headerRef}
      className={cn(
        "w-full flex-shrink-0 border-b border-white/15 bg-background px-4 sm:px-6 lg:px-10",
        menuOpen && "relative z-[70]",
      )}
    >
      {/* Desktop header */}
      <div className="flex h-14 items-center justify-between gap-8 max-md:hidden">
        <Link
          href="/"
          className={cn(focusRing, "flex items-center gap-2.5")}
          aria-label="DiggerAI home"
        >
          <HackerAISVG theme="dark" scale={0.14} />
          <span className="text-lg font-medium tracking-[-0.03em] text-foreground">
            DiggerAI
          </span>
        </Link>
        <div className="flex flex-1 items-center justify-between gap-4">
          {chatTitle && (
            <div className="min-w-0 flex-1 text-center">
              <span className="block truncate text-lg font-medium text-foreground">
                {chatTitle}
              </span>
            </div>
          )}
          {!chatTitle && (
            <nav className="flex items-center gap-1" aria-label="Primary">
              {publicNavigation.map((item) => {
                if (item.href === "/download") return null;
                const isCurrent = item.href === currentPath;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isCurrent ? "page" : undefined}
                    className={menuItem(isCurrent)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
          {signedOut && (
            <div className="flex items-center gap-2">
              <Link
                href="/download"
                aria-current={currentPath === "/download" ? "page" : undefined}
                className={menuItem(currentPath === "/download")}
              >
                Download
              </Link>
              <button
                type="button"
                data-testid="sign-in-button"
                onClick={() => navigateToAuth("/login")}
                className={outlineButton}
              >
                Sign in
              </button>
              <button
                type="button"
                data-testid="sign-up-button"
                onClick={startSignUp}
                className={solidButton}
              >
                Start free
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile header */}
      <div className="flex h-14 items-center justify-between gap-3 md:hidden">
        <Link
          href="/"
          className={cn(focusRing, "flex min-h-11 items-center gap-2")}
          aria-label="DiggerAI home"
        >
          <HackerAISVG theme="dark" scale={0.12} />
          <span className="hidden text-base font-medium tracking-[-0.03em] text-foreground min-[400px]:inline">
            DiggerAI
          </span>
        </Link>
        {signedOut && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="sign-in-button-mobile"
              onClick={() => navigateToAuth("/login")}
              className={outlineButton}
            >
              Sign in
            </button>
            <button
              type="button"
              data-testid="sign-up-button-mobile"
              onClick={startSignUp}
              className={solidButton}
            >
              Start free
            </button>
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen((open) => !open)}
              className={cn(
                geistPixel.className,
                focusRing,
                "inline-flex h-11 min-w-14 items-center justify-center px-2 text-base",
                menuOpen
                  ? "bg-white text-black"
                  : "text-white hover:bg-white/10",
              )}
            >
              {menuOpen ? "Close" : "Menu"}
            </button>
          </div>
        )}
      </div>

      {/* Mobile menu: appears under the header without moving it. */}
      {menuOpen && (
        <div
          id="mobile-navigation"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className="fixed inset-x-0 bottom-0 z-[60] overflow-y-auto bg-background px-4 py-6 sm:px-6 md:hidden"
          style={{ top: menuTop }}
        >
          <nav aria-label="Mobile">
            <ul className="border-t border-white/15">
              {publicNavigation.map((item, index) => {
                const isCurrent = item.href === currentPath;
                return (
                  <li key={item.href} className="border-b border-white/15">
                    <Link
                      href={item.href}
                      onClick={closeMenu}
                      aria-current={isCurrent ? "page" : undefined}
                      className={cn(
                        focusRing,
                        "flex min-h-16 items-center gap-4 text-3xl font-medium tracking-[-0.03em]",
                        isCurrent ? "text-white" : "text-white/70",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          geistPixel.className,
                          "w-7 text-base",
                          isCurrent ? "text-white" : "text-muted-foreground",
                        )}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {item.label}
                      {isCurrent ? (
                        <span
                          aria-hidden="true"
                          className="ml-auto size-2.5 bg-white"
                        />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
