const mockPolar = {
  customers: { getStateExternal: jest.fn() },
  products: { get: jest.fn(), list: jest.fn() },
  checkouts: { create: jest.fn() },
  customerSessions: { create: jest.fn() },
};
const mockGetUser = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock("@polar-sh/sdk/2026-10", () => ({
  createPolar: () => mockPolar,
  webhooks: {},
}));

jest.mock("@workos-inc/authkit-nextjs", () => ({ withAuth: jest.fn() }));

jest.mock("@/app/api/workos", () => ({
  workos: {
    userManagement: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    },
  },
}));

import {
  createPolarCheckout,
  getPolarSubscriptionStatus,
  polarWebhookUserId,
  syncPolarEntitlements,
} from "@/lib/billing/polar";

const notFound = Object.assign(new Error("Not found"), { statusCode: 404 });

const subscription = (overrides: Record<string, unknown> = {}) => ({
  id: "sub_1",
  product_id: "prod_pro_plus_monthly",
  status: "active",
  amount: 6000,
  currency: "usd",
  recurring_interval: "month",
  current_period_end: "2026-11-12T00:00:00Z",
  cancel_at_period_end: false,
  ...overrides,
});

beforeAll(() => {
  process.env.POLAR_ACCESS_TOKEN = "polar_oat_test";
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({
    id: "user_1",
    email: "researcher@example.org",
    firstName: "Ada",
    lastName: null,
    metadata: {},
  });
  mockPolar.products.get.mockImplementation(async (id: string) => ({
    id,
    metadata:
      id === "prod_pro_plus_monthly" ? { plan: "pro-plus-monthly-plan" } : {},
  }));
});

describe("syncPolarEntitlements", () => {
  it("writes the active plan into WorkOS metadata for the JWT template", async () => {
    mockPolar.customers.getStateExternal.mockResolvedValue({
      active_subscriptions: [subscription()],
    });

    await expect(syncPolarEntitlements("user_1")).resolves.toEqual([
      "pro-plus-plan",
      "pro-plus-monthly-plan",
    ]);
    expect(mockPolar.customers.getStateExternal).toHaveBeenCalledWith("user_1");
    expect(mockUpdateUser).toHaveBeenCalledWith({
      userId: "user_1",
      metadata: { billing_entitlements: "pro-plus-plan,pro-plus-monthly-plan" },
    });
  });

  it("clears paid access once Polar has no active subscription", async () => {
    mockGetUser.mockResolvedValue({
      id: "user_1",
      metadata: { billing_entitlements: "pro-plan,pro-monthly-plan" },
    });
    mockPolar.customers.getStateExternal.mockRejectedValue(notFound);

    await expect(syncPolarEntitlements("user_1")).resolves.toEqual([]);
    expect(mockUpdateUser).toHaveBeenCalledWith({
      userId: "user_1",
      metadata: { billing_entitlements: null },
    });
  });

  it("skips the WorkOS write when nothing changed", async () => {
    mockGetUser.mockResolvedValue({
      id: "user_1",
      metadata: { billing_entitlements: "pro-plus-plan,pro-plus-monthly-plan" },
    });
    mockPolar.customers.getStateExternal.mockResolvedValue({
      active_subscriptions: [subscription()],
    });

    await syncPolarEntitlements("user_1");
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("ignores subscriptions to products that name no DiggerAI plan", async () => {
    mockPolar.customers.getStateExternal.mockResolvedValue({
      active_subscriptions: [subscription({ product_id: "prod_other" })],
    });

    await expect(syncPolarEntitlements("user_1")).resolves.toEqual([]);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("surfaces Polar outages instead of revoking access", async () => {
    mockGetUser.mockResolvedValue({
      id: "user_1",
      metadata: { billing_entitlements: "pro-plan,pro-monthly-plan" },
    });
    mockPolar.customers.getStateExternal.mockRejectedValue(
      Object.assign(new Error("Bad gateway"), { statusCode: 502 }),
    );

    await expect(syncPolarEntitlements("user_1")).rejects.toThrow(
      "Bad gateway",
    );
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});

describe("createPolarCheckout", () => {
  it("rejects plans Polar does not sell", async () => {
    const result = await createPolarCheckout(
      "user_1",
      "team-monthly-plan",
      "http://localhost:3000",
    );
    expect(result.status).toBe(400);
    expect(mockPolar.checkouts.create).not.toHaveBeenCalled();
  });

  it("sends existing subscribers to the portal instead of a second checkout", async () => {
    mockPolar.customers.getStateExternal.mockResolvedValue({
      active_subscriptions: [subscription()],
    });

    const result = await createPolarCheckout(
      "user_1",
      "ultra-monthly-plan",
      "http://localhost:3000",
    );
    expect(result).toMatchObject({
      status: 409,
      body: { code: "subscription_exists" },
    });
    expect(mockPolar.checkouts.create).not.toHaveBeenCalled();
  });

  it("reports a plan whose Polar product is missing", async () => {
    mockPolar.customers.getStateExternal.mockRejectedValue(notFound);
    mockPolar.products.list.mockResolvedValue({ items: [] });

    const result = await createPolarCheckout(
      "user_1",
      "pro-monthly-plan",
      "http://localhost:3000",
    );
    expect(result.status).toBe(503);
  });

  it("opens checkout for the plan's product, linked to the WorkOS user", async () => {
    mockPolar.customers.getStateExternal.mockRejectedValue(notFound);
    mockPolar.products.list.mockResolvedValue({
      items: [{ id: "prod_pro_monthly" }],
    });
    mockPolar.checkouts.create.mockResolvedValue({
      url: "https://sandbox.polar.sh/checkout/abc",
    });

    const result = await createPolarCheckout(
      "user_1",
      "pro-monthly-plan",
      "http://localhost:3000",
    );

    expect(result).toEqual({
      status: 200,
      body: { url: "https://sandbox.polar.sh/checkout/abc" },
    });
    expect(mockPolar.products.list).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { plan: "pro-monthly-plan" } }),
    );
    expect(mockPolar.checkouts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        products: ["prod_pro_monthly"],
        external_customer_id: "user_1",
        customer_email: "researcher@example.org",
        customer_name: "Ada",
        success_url: "http://localhost:3000/?refresh=entitlements",
      }),
    );
  });
});

describe("getPolarSubscriptionStatus", () => {
  it("maps the renewal and a scheduled cancellation for Account settings", async () => {
    mockPolar.customers.getStateExternal.mockResolvedValue({
      active_subscriptions: [subscription({ cancel_at_period_end: true })],
    });

    await expect(getPolarSubscriptionStatus("user_1")).resolves.toEqual({
      billingAccountAvailable: true,
      hasActiveSubscription: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: Date.parse("2026-11-12T00:00:00Z"),
      subscriptionStatus: "active",
      renewalAmountDollars: 60,
      renewalCurrency: "usd",
      renewalInterval: "month",
    });
  });

  it("treats a user who never bought as having no billing account", async () => {
    mockPolar.customers.getStateExternal.mockRejectedValue(notFound);

    await expect(getPolarSubscriptionStatus("user_1")).resolves.toEqual({
      hasActiveSubscription: false,
      cancelAtPeriodEnd: false,
    });
  });
});

describe("polarWebhookUserId", () => {
  it("finds the WorkOS user on state and subscription events only", () => {
    expect(
      polarWebhookUserId({
        type: "customer.state_changed",
        data: { external_id: "user_1" },
      } as never),
    ).toBe("user_1");
    expect(
      polarWebhookUserId({
        type: "subscription.revoked",
        data: { customer: { external_id: "user_2" } },
      } as never),
    ).toBe("user_2");
    expect(
      polarWebhookUserId({
        type: "order.paid",
        data: { customer: { external_id: "user_3" } },
      } as never),
    ).toBeNull();
  });
});
