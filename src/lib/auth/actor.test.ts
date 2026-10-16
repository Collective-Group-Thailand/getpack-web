// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/problem";

const get = vi.fn();

vi.mock("@/lib/api/server", () => ({
  serverApi: vi.fn(async () => ({ GET: get })),
}));

// React's `cache` memoises per render; outside one it would hold results across tests.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T) => fn };
});

let getActor: typeof import("./actor").getActor;
let can: typeof import("./actor").can;

beforeAll(async () => {
  ({ getActor, can } = await import("./actor"));
});

beforeEach(() => {
  vi.clearAllMocks();
});

const apiError = (status: number) =>
  new ApiError({
    type: `https://errors.getpack/http.${status}`,
    title: "t",
    status,
    code: `http.${status}`,
    detail: "d",
    requestId: "r",
  });

describe("getActor", () => {
  it("asks each zone its own /me endpoint", async () => {
    get.mockResolvedValue({ data: { id: "1", type: "staff" } });

    await getActor("admin");
    expect(get).toHaveBeenCalledWith("/v1/admin/me");

    await getActor("partner");
    expect(get).toHaveBeenCalledWith("/v1/partner/me");

    await getActor("customer");
    expect(get).toHaveBeenCalledWith("/v1/store/me");
  });

  it("returns the actor the API describes", async () => {
    get.mockResolvedValue({ data: { id: "2", type: "staff", displayName: "พนักงานตัวอย่าง", roles: ["cs"] } });

    await expect(getActor("admin")).resolves.toMatchObject({ displayName: "พนักงานตัวอย่าง", roles: ["cs"] });
  });

  it("reports no session on a 401", async () => {
    get.mockRejectedValue(apiError(401));

    await expect(getActor("admin")).resolves.toBeNull();
  });

  it("reports no session on a 403 — a token for the wrong audience", async () => {
    // This is exactly what a customer cookie looks like on the admin host: the API rejects
    // a token whose `aud` does not match the surface (api-conventions §2), and from this
    // app's side that is simply "not signed in here".
    get.mockRejectedValue(apiError(403));

    await expect(getActor("admin")).resolves.toBeNull();
  });

  it("re-throws a server error instead of calling it a lost session", async () => {
    // Treating a 500 as "signed out" would bounce a signed-in user to a login screen
    // because a database was briefly slow — and they would sign in to be bounced again.
    get.mockRejectedValue(apiError(503));

    await expect(getActor("admin")).rejects.toBeInstanceOf(ApiError);
  });

  it("re-throws a transport failure for the same reason", async () => {
    get.mockRejectedValue(new TypeError("fetch failed"));

    await expect(getActor("admin")).rejects.toBeInstanceOf(TypeError);
  });
});

describe("can", () => {
  const staff = { id: "1", type: "staff" as const, permissions: ["orders.read"] };

  it("is true only for a permission the actor holds", () => {
    expect(can(staff as never, "orders.read")).toBe(true);
    expect(can(staff as never, "orders.cancel")).toBe(false);
  });

  it("is false with no actor at all", () => {
    expect(can(null, "orders.read")).toBe(false);
  });
});
