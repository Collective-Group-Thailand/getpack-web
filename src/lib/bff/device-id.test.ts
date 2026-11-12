import { describe, expect, it } from "vitest";

import { DEVICE_COOKIE, deviceIdOf, needsDeviceId, withDeviceId } from "./device-id";

const encode = (value: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};
const decode = (body: ArrayBuffer | undefined) => JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>;

describe("the free dieline download's device id (D-471)", () => {
  it("applies to the customer zone's free download only", () => {
    expect(needsDeviceId("customer", "/v1/store/dielines/downloads/free", "POST")).toBe(true);
    expect(needsDeviceId("customer", "/v1/store/dielines/downloads", "POST")).toBe(false);
    expect(needsDeviceId("customer", "/v1/store/dielines/downloads/free", "GET")).toBe(false);
    expect(needsDeviceId("admin", "/v1/store/dielines/downloads/free", "POST")).toBe(false);
  });

  it("keeps a well-formed cookie and makes an httpOnly one otherwise", () => {
    const kept = deviceIdOf("0192F3A0-7C1E-7D2A-9B1F-00000000D702", true);
    expect(kept).toEqual({ id: "0192f3a0-7c1e-7d2a-9b1f-00000000d702", write: null });
    const made = deviceIdOf("not-a-uuid", false);
    expect(made.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(made.write).toMatchObject({
      name: DEVICE_COOKIE,
      value: made.id,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("writes the cookie's id over whatever the browser sent", () => {
    const body = withDeviceId(encode({ variantCode: "PK-1", deviceId: "00000000-0000-4000-8000-000000000000" }), "abc");
    expect(decode(body)).toEqual({ variantCode: "PK-1", deviceId: "abc" });
  });

  it("passes a body that is not a JSON object on untouched (the API answers it)", () => {
    const text = new TextEncoder().encode("not json").buffer as ArrayBuffer;
    expect(withDeviceId(text, "abc")).toBe(text);
    expect(withDeviceId(undefined, "abc")).toBeUndefined();
  });
});
