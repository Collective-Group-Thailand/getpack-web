import { describe, expect, it } from "vitest";

import { clientIp, isIpAddress } from "./client-ip";

const chain = (value: string) => new Headers({ "x-forwarded-for": value });

describe("clientIp", () => {
  it("takes the entry the outermost trusted proxy appended", () => {
    expect(clientIp(chain("203.0.113.9"), 1)).toBe("203.0.113.9");
    expect(clientIp(chain("198.51.100.7, 203.0.113.9"), 1)).toBe("203.0.113.9");
    expect(clientIp(chain("198.51.100.7, 203.0.113.9, 10.0.0.4"), 2)).toBe("203.0.113.9");
  });

  it("ignores what a visitor puts in front of the trusted entries", () => {
    // A spoofed left-hand entry never becomes the address, however many there are.
    expect(clientIp(chain("1.1.1.1, 2.2.2.2, 203.0.113.9"), 1)).toBe("203.0.113.9");
  });

  it("knows nothing without a trusted hop", () => {
    expect(clientIp(chain("203.0.113.9"), 0)).toBeNull();
    expect(clientIp(new Headers(), 1)).toBeNull();
  });

  it("refuses to guess when the chain is shorter than the trusted hops", () => {
    expect(clientIp(chain("203.0.113.9"), 2)).toBeNull();
  });

  it("refuses an entry that is not an address", () => {
    expect(clientIp(chain("unknown"), 1)).toBeNull();
    expect(clientIp(chain("203.0.113.9, <script>"), 1)).toBeNull();
    expect(clientIp(chain("999.0.113.9"), 1)).toBeNull();
  });

  it("accepts IPv6", () => {
    expect(clientIp(chain("2001:db8::1"), 1)).toBe("2001:db8::1");
    expect(isIpAddress("::ffff:203.0.113.9")).toBe(true);
  });
});
