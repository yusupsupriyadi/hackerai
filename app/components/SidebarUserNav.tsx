"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  LogOut,
  Sparkle,
  ChevronRight,
  ChevronDown,
  Settings,
  CircleUserRound,
  Gauge,
  Download,
  ExternalLink,
  RefreshCw,
  Gift,
  ShieldCheck,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useGlobalState } from "@/app/contexts/GlobalState";
import { redirectToPricing } from "../hooks/usePricingDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsStandalone } from "@/hooks/use-is-standalone";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { clientLogout } from "@/lib/utils/logout";
import { isPolarBilling } from "@/lib/billing/provider";
import {
  openSettingsDialog,
  preloadSettingsDialog,
} from "@/lib/utils/settings-dialog";
import { ReferralRewardDialog } from "./ReferralRewardDialog";

// Upgrade banner component
const UpgradeBanner = ({ isCollapsed }: { isCollapsed: boolean }) => {
  const { isCheckingProPlan, subscription } = useGlobalState();
  const isProUser = subscription !== "free";

  // Don't show for pro users or while checking
  if (isCheckingProPlan || isProUser) {
    return null;
  }

  const handleUpgrade = () => {
    redirectToPricing({
      surface: "sidebar_upgrade_banner",
      source: "sidebar",
      from_tier: subscription,
      cta_text: "Upgrade to Pro",
    });
  };

  if (isCollapsed) {
    return (
      <div className="mb-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-testid="upgrade-button-collapsed"
                variant="secondary"
                size="sm"
                className="h-8 w-full border-0 bg-premium-bg px-2 text-premium-text hover:bg-premium-hover"
                onClick={handleUpgrade}
                aria-label="Upgrade to Pro"
              >
                <Zap className="size-4 fill-current" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Upgrade to Pro</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={handleUpgrade}
        aria-label="Upgrade to Pro and unlock more features"
        className="bg-muted/50 hover:bg-muted/80 border-sidebar-border hover:border-violet-500/70 dark:hover:border-violet-400/70 flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-foreground truncate text-sm font-medium leading-none">
            Upgrade to Pro
          </p>
          <p className="text-muted-foreground truncate text-xs">
            Unlock more features
          </p>
        </div>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-premium-bg text-premium-text">
          <Zap className="size-4 fill-current" />
        </div>
      </button>
    </div>
  );
};

const SidebarUserNav = ({ isCollapsed = false }: { isCollapsed?: boolean }) => {
  const { user } = useAuth();
  const { subscription } = useGlobalState();
  const [rateLimitsExpanded, setRateLimitsExpanded] = useState(false);
  const [referralDialogOpen, setReferralDialogOpen] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<{
    monthly: {
      remaining: number;
      limit: number;
      used: number;
      usagePercentage: number;
      resetTime: string | null;
    };
    monthlyBudgetUsd: number;
  } | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const [usageFetchFailed, setUsageFetchFailed] = useState(false);
  const isMobile = useIsMobile();
  const isStandalone = useIsStandalone();
  const isPaidUser = subscription !== "free";

  const getAgentRateLimitStatus = useAction(
    api.rateLimitStatus.getAgentRateLimitStatus,
  );

  const extraUsageSettings = useQuery(api.extraUsage.getExtraUsageSettings);
  const userCustomization = useQuery(
    api.userCustomization.getUserCustomization,
  );
  const extraUsageEnabled = userCustomization?.extra_usage_enabled ?? false;
  const extraUsageBalanceDollars = extraUsageSettings?.balanceDollars ?? 0;
  const extraUsageMonthlySpentDollars =
    extraUsageSettings?.monthlySpentDollars ?? 0;
  const extraUsageMonthlyCapDollars = extraUsageSettings?.monthlyCapDollars;
  const extraUsageMonthlyLimitLabel =
    extraUsageMonthlyCapDollars != null
      ? `$${extraUsageMonthlyCapDollars.toFixed(2)} limit`
      : "No limit";

  const fetchTokenUsage = useCallback(async () => {
    if (!isPaidUser) return;
    setIsLoadingUsage(true);
    try {
      const status = await getAgentRateLimitStatus({ subscription });
      setTokenUsage(status);
      setUsageFetchFailed(false);
    } catch {
      setUsageFetchFailed(true);
    } finally {
      setIsLoadingUsage(false);
    }
  }, [subscription, isPaidUser, getAgentRateLimitStatus]);

  // Reset error state when subscription changes so it can retry
  useEffect(() => {
    setUsageFetchFailed(false);
  }, [subscription]);

  useEffect(() => {
    if (
      rateLimitsExpanded &&
      !tokenUsage &&
      !isLoadingUsage &&
      !usageFetchFailed
    ) {
      fetchTokenUsage();
    }
  }, [
    rateLimitsExpanded,
    tokenUsage,
    isLoadingUsage,
    usageFetchFailed,
    fetchTokenUsage,
  ]);

  if (!user) return null;

  const handleLogOut = () => {
    clientLogout();
  };

  const handleTrustPage = () => {
    const newWindow = window.open("/trust", "_blank", "noopener,noreferrer");
    if (newWindow) {
      newWindow.opener = null;
    }
  };

  const getUserInitials = () => {
    const firstName = user.firstName?.charAt(0)?.toUpperCase() || "";
    const lastName = user.lastName?.charAt(0)?.toUpperCase() || "";
    if (firstName && lastName) {
      return firstName + lastName;
    }
    if (firstName) {
      return firstName;
    }
    if (lastName) {
      return lastName;
    }
    return user.email?.charAt(0)?.toUpperCase() || "U";
  };

  const getDisplayName = () => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.firstName || user.lastName || "User";
  };

  const includedUsageRemainingPercentage =
    tokenUsage && tokenUsage.monthly.limit > 0
      ? Math.round(
          (tokenUsage.monthly.remaining / tokenUsage.monthly.limit) * 100,
        )
      : 0;

  return (
    <div className="relative">
      <ReferralRewardDialog
        open={referralDialogOpen}
        onOpenChange={setReferralDialogOpen}
      />

      {/* Upgrade banner above user nav */}
      <UpgradeBanner isCollapsed={isCollapsed} />

      <DropdownMenu
        onOpenChange={(open) => {
          if (open) preloadSettingsDialog();
        }}
      >
        <DropdownMenuTrigger asChild>
          {isCollapsed ? (
            /* Collapsed state - only show avatar */
            <div className="mb-1">
              <button
                data-testid="user-menu-button-collapsed"
                type="button"
                className="flex items-center justify-center p-2 cursor-pointer hover:bg-sidebar-accent/50 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 w-full"
                aria-haspopup="menu"
                aria-label={`Open user menu for ${getDisplayName()}`}
                onPointerEnter={preloadSettingsDialog}
                onFocus={preloadSettingsDialog}
              >
                <Avatar data-testid="user-avatar" className="h-7 w-7">
                  <AvatarImage
                    src={user.profilePictureUrl || undefined}
                    alt={getDisplayName()}
                  />
                  <AvatarFallback className="text-xs">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </div>
          ) : (
            /* Expanded state - show full user info */
            <button
              data-testid="user-menu-button"
              type="button"
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-sidebar-accent/50 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 w-full text-left"
              aria-haspopup="menu"
              aria-label={`Open user menu for ${getDisplayName()}`}
              onPointerEnter={preloadSettingsDialog}
              onFocus={preloadSettingsDialog}
            >
              <Avatar data-testid="user-avatar" className="h-7 w-7">
                <AvatarImage
                  src={user.profilePictureUrl || undefined}
                  alt={getDisplayName()}
                />
                <AvatarFallback className="text-xs">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-sidebar-foreground truncate">
                  {getDisplayName()}
                </div>
                <div
                  data-testid="subscription-badge"
                  className="text-xs text-sidebar-accent-foreground truncate"
                >
                  {subscription === "ultra"
                    ? "Ultra"
                    : subscription === "team"
                      ? "Team"
                      : subscription === "pro-plus"
                        ? "Pro+"
                        : subscription === "pro"
                          ? "Pro"
                          : "Free"}
                </div>
              </div>
            </button>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className="w-[calc(var(--radix-dropdown-menu-trigger-width)-12px)] min-w-[240px] rounded-2xl py-1.5"
          align="center"
          side="top"
          sideOffset={0}
        >
          <DropdownMenuLabel className="font-normal py-1.5">
            <div className="flex items-center space-x-2">
              <CircleUserRound className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <p
                data-testid="user-email"
                className="leading-none text-muted-foreground truncate min-w-0 text-sm"
              >
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {(subscription === "pro" || subscription === "pro-plus") && (
            <DropdownMenuItem
              data-testid="upgrade-menu-item"
              onClick={() =>
                redirectToPricing({
                  surface: "sidebar_user_menu",
                  source: "account_menu",
                  from_tier: subscription,
                  cta_text: "Upgrade Plan",
                })
              }
              className="py-1.5"
            >
              <Sparkle className="mr-2 h-4 w-4 text-foreground" />
              <span>Upgrade Plan</span>
            </DropdownMenuItem>
          )}

          {isPaidUser && (
            <DropdownMenuItem
              data-testid="referral-menu-item"
              onSelect={() => setReferralDialogOpen(true)}
              className="py-1.5"
            >
              <Gift className="mr-2 h-4 w-4 text-foreground" />
              <span>Refer a friend</span>
            </DropdownMenuItem>
          )}

          {isPaidUser && (
            <div>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setRateLimitsExpanded(!rateLimitsExpanded);
                }}
                className="py-1.5"
              >
                <Gauge className="mr-2 h-4 w-4 text-foreground" />
                <span className="flex-1">Usage</span>
                {rateLimitsExpanded ? (
                  <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                )}
              </DropdownMenuItem>
              {rateLimitsExpanded && (
                <div className="px-3 pb-2 space-y-0.5">
                  {isLoadingUsage ? (
                    <div className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Loading...</span>
                    </div>
                  ) : tokenUsage ? (
                    <>
                      <div className="flex items-center justify-between py-1.5 text-sm">
                        <span className="text-muted-foreground">Included</span>
                        <div className="flex items-center gap-3 tabular-nums text-muted-foreground">
                          <span>{includedUsageRemainingPercentage}% left</span>
                          {tokenUsage.monthly.resetTime && (
                            <span>
                              {new Date(
                                tokenUsage.monthly.resetTime,
                              ).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                      {extraUsageEnabled && (
                        <>
                          <div className="flex items-center justify-between py-1.5 text-sm">
                            <span className="text-muted-foreground">
                              Extra balance
                            </span>
                            <span className="min-w-0 text-right tabular-nums text-muted-foreground">
                              ${extraUsageBalanceDollars.toFixed(2)} available
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-1.5 text-sm">
                            <span className="text-muted-foreground">
                              This month
                            </span>
                            <div className="ml-3 flex min-w-0 flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 text-right tabular-nums text-muted-foreground">
                              <span>
                                ${extraUsageMonthlySpentDollars.toFixed(2)}{" "}
                                spent
                              </span>
                              <span className="text-muted-foreground/60">
                                /
                              </span>
                              <span>{extraUsageMonthlyLimitLabel}</span>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="py-1.5 text-sm text-muted-foreground">
                      Unable to load usage
                    </div>
                  )}
                  {!isPolarBilling() && (
                    <button
                      onClick={() => openSettingsDialog("Extra Usage")}
                      className="-mx-3 px-3 w-[calc(100%+1.5rem)] flex items-center gap-2.5 py-1.5 rounded-md text-left text-sm hover:bg-muted transition-colors"
                      aria-label="Open extra usage settings"
                      tabIndex={0}
                    >
                      <span className="flex-1">Extra usage</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <DropdownMenuItem
            data-testid="settings-button"
            onClick={() => openSettingsDialog()}
            className="py-1.5"
          >
            <Settings className="mr-2 h-4 w-4 text-foreground" />
            <span>Settings</span>
          </DropdownMenuItem>

          {!isStandalone && (
            <DropdownMenuItem asChild className="py-1.5">
              <Link href="/download">
                <Download className="mr-2 h-4 w-4 text-foreground" />
                <span>{isMobile ? "Install App" : "Download App"}</span>
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleTrustPage} className="py-1.5">
            <ShieldCheck className="mr-2 h-4 w-4 text-foreground" />
            <span>Security &amp; Trust</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            data-testid="logout-button"
            onClick={handleLogOut}
            className="py-1.5"
          >
            <LogOut className="mr-2 h-4 w-4 text-foreground" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default SidebarUserNav;
