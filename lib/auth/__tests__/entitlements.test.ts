import {
  hasPaidEntitlement,
  parseEntitlements,
  resolveSubscriptionTier,
} from "@/lib/auth/entitlements";

const ENV_KEY = "NEXT_PUBLIC_SELF_HOSTED_ENTITLEMENTS";
const BILLING_KEY = "NEXT_PUBLIC_BILLING_PROVIDER";
const original = process.env[ENV_KEY];
const originalBilling = process.env[BILLING_KEY];

afterEach(() => {
  if (original === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = original;
  if (originalBilling === undefined) delete process.env[BILLING_KEY];
  else process.env[BILLING_KEY] = originalBilling;
});

describe("token entitlements", () => {
  it("keeps only string entitlements and resolves the highest tier", () => {
    delete process.env[ENV_KEY];
    expect(parseEntitlements(["pro-plan", 3, null])).toEqual(["pro-plan"]);
    expect(parseEntitlements(42)).toEqual([]);
    expect(resolveSubscriptionTier(["pro-plan", "ultra-plan"])).toBe("ultra");
    expect(resolveSubscriptionTier([])).toBe("free");
  });

  it("reads the comma-separated claim the WorkOS JWT template sends", () => {
    delete process.env[ENV_KEY];
    expect(parseEntitlements("pro-plus-plan, pro-plus-monthly-plan")).toEqual([
      "pro-plus-plan",
      "pro-plus-monthly-plan",
    ]);
    expect(
      resolveSubscriptionTier(parseEntitlements("pro-plan,pro-yearly-plan")),
    ).toBe("pro");
    expect(parseEntitlements("")).toEqual([]);
  });
});

describe("billing provider", () => {
  it("stops the self-hosted grant so only paid plans count", () => {
    process.env[ENV_KEY] = "ultra-plan";
    process.env[BILLING_KEY] = "polar";

    expect(parseEntitlements(undefined)).toEqual([]);
    expect(resolveSubscriptionTier([])).toBe("free");
    expect(resolveSubscriptionTier(parseEntitlements("pro-plan"))).toBe("pro");
  });
});

describe("self-hosted entitlements", () => {
  it("grants the configured entitlements on top of the token's", () => {
    process.env[ENV_KEY] = " ultra-plan , ";
    delete process.env[BILLING_KEY];

    expect(parseEntitlements(["pro-plan"])).toEqual(["pro-plan", "ultra-plan"]);
    expect(parseEntitlements(["ultra-plan"])).toEqual(["ultra-plan"]);
    expect(parseEntitlements(undefined)).toEqual(["ultra-plan"]);
    expect(resolveSubscriptionTier([])).toBe("ultra");
    expect(hasPaidEntitlement([])).toBe(true);
  });
});
