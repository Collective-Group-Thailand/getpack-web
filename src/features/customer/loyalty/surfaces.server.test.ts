import { beforeEach, describe, expect, it, vi } from "vitest";

const token = vi.fn<() => string | null>();
const config = vi.fn();
const call = vi.fn();

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/auth/session", () => ({ readAccessToken: () => token() }));
vi.mock("@/features/customer/catalog/api.server", () => ({ getPublicConfig: () => config() }));
vi.mock("@/lib/api/requests/server", () => ({ serverRequests: async () => ({ call }) }));
// React's request cache is a no-op outside a server render; each test reads afresh.
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: <T>(fn: T) => fn }));

const { getLoyaltySurfaces } = await import("./surfaces.server");

const open = {
  deals: true,
  dealsLiff: true,
  redeem: true,
  tierPerks: true,
  checklist: true,
  pointsLiff: true,
  quoteRecovery: true,
};

describe("getLoyaltySurfaces (loyalty P4)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads a guest's surfaces from publicConfig's anonymous view", async () => {
    token.mockReturnValue(null);
    config.mockResolvedValue({ loyaltySurfaces: { ...open, redeem: false } });
    expect(await getLoyaltySurfaces()).toEqual({ ...open, redeem: false });
    expect(call).not.toHaveBeenCalled();
  });

  it("reads a signed-in customer's own surfaces", async () => {
    token.mockReturnValue("t");
    call.mockResolvedValue(open);
    expect(await getLoyaltySurfaces()).toEqual(open);
    expect(call).toHaveBeenCalledWith("GET /v1/store/loyalty/surfaces");
  });

  it("closes every gated surface when the read fails", async () => {
    token.mockReturnValue("t");
    call.mockRejectedValue(new Error("down"));
    expect(Object.values(await getLoyaltySurfaces()).some(Boolean)).toBe(false);
  });
});
