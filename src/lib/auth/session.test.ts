import { describe, expect, it } from "vitest";

import {
  clearedSessionCookieWrites,
  readAccessToken,
  readRefreshToken,
  readSessionTokens,
  sessionCookieWrites,
  type CookieReader,
} from "./session";

function jar(cookies: Record<string, string>): CookieReader {
  return { get: (name) => (name in cookies ? { value: cookies[name]! } : undefined) };
}

const session = {
  accessToken: "at",
  accessTokenExpiresAt: new Date("2026-09-23T14:15:00Z"),
  refreshToken: "rt",
  refreshTokenExpiresAt: new Date("2026-10-23T14:00:00Z"),
};

describe("readSessionTokens", () => {
  it("reads the prefixed names over https", () => {
    const tokens = readSessionTokens(
      jar({ "__Host-pk_at": "a", "__Host-pk_rt": "r", "__Host-pk_ate": "1790000000" }),
      true,
    );

    expect(tokens.accessToken).toBe("a");
    expect(tokens.refreshToken).toBe("r");
    expect(tokens.accessExpiresAt).toEqual(new Date(1790000000 * 1000));
  });

  it("reads the bare names over http, where __Host- cannot be set", () => {
    const tokens = readSessionTokens(jar({ pk_at: "a", pk_rt: "r" }), false);

    expect(tokens.accessToken).toBe("a");
    expect(tokens.refreshToken).toBe("r");
  });

  it("reports a missing session as undefined rather than empty strings", () => {
    const tokens = readSessionTokens(jar({}), true);

    expect(tokens.accessToken).toBeUndefined();
    expect(tokens.refreshToken).toBeUndefined();
    expect(tokens.accessExpiresAt).toBeNull();
  });
});

describe("reading without knowing the scheme", () => {
  it("finds the token under either spelling, for callers that cannot see the protocol", () => {
    expect(readAccessToken(jar({ "__Host-pk_at": "secure" }))).toBe("secure");
    expect(readAccessToken(jar({ pk_at: "local" }))).toBe("local");
    expect(readRefreshToken(jar({ "__Host-pk_rt": "secure" }))).toBe("secure");
    expect(readRefreshToken(jar({ pk_rt: "local" }))).toBe("local");
  });

  it("prefers the prefixed cookie when both somehow exist", () => {
    expect(readAccessToken(jar({ "__Host-pk_at": "secure", pk_at: "local" }))).toBe("secure");
  });
});

describe("sessionCookieWrites", () => {
  it("writes the three cookies with the flags ADR-0005 requires", () => {
    const writes = sessionCookieWrites(session, true).slice(0, 3);

    expect(writes.map((write) => write.name)).toEqual(["__Host-pk_at", "__Host-pk_ate", "__Host-pk_rt"]);
    for (const write of writes) {
      expect(write).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
      // Host-only is the isolation between zones: a Domain would let a cookie cross hosts.
      expect(write).not.toHaveProperty("domain");
    }
  });

  it("drops the __Host- prefix over plain http so local development works", () => {
    expect(
      sessionCookieWrites(session, false)
        .slice(0, 3)
        .map((write) => write.name),
    ).toEqual(["pk_at", "pk_ate", "pk_rt"]);
  });

  it("clears the other spelling, so a stale __Host- cookie cannot shadow a new http session", () => {
    // Chrome keeps a Secure `__Host-` cookie on http://*.localhost, and `readAccessToken`
    // prefers it: left in place, the visitor signs in and lands back on the sign-in page.
    const clears = sessionCookieWrites(session, false).slice(3);

    expect(clears.map((write) => write.name)).toEqual(["__Host-pk_at", "__Host-pk_ate", "__Host-pk_rt"]);
    for (const write of clears) {
      expect(write).toMatchObject({ value: "", maxAge: 0, secure: true, path: "/" });
    }
  });

  it("clears the bare names over https", () => {
    const clears = sessionCookieWrites(session, true).slice(3);

    expect(clears.map((write) => write.name)).toEqual(["pk_at", "pk_ate", "pk_rt"]);
    for (const write of clears) {
      expect(write).toMatchObject({ value: "", maxAge: 0, secure: false });
    }
  });

  it("expires each cookie with the token it holds", () => {
    const [access, expiry, refresh] = sessionCookieWrites(session, true);

    expect(access!.expires).toEqual(session.accessTokenExpiresAt);
    expect(expiry!.expires).toEqual(session.accessTokenExpiresAt);
    // The refresh cookie outlives the access token — it is what a returning visitor is
    // signed in by, so its own expiry is the real end of the session.
    expect(refresh!.expires).toEqual(session.refreshTokenExpiresAt);
  });

  it("records the access expiry in epoch seconds, so the proxy never parses the JWT", () => {
    const [, expiry] = sessionCookieWrites(session, true);

    expect(expiry!.value).toBe(String(Math.floor(session.accessTokenExpiresAt.getTime() / 1000)));
  });
});

describe("clearedSessionCookieWrites", () => {
  it("clears both spellings of all three cookies", () => {
    const writes = clearedSessionCookieWrites();

    expect(writes.map((write) => write.name).sort()).toEqual(
      ["__Host-pk_at", "__Host-pk_ate", "__Host-pk_rt", "pk_at", "pk_ate", "pk_rt"].sort(),
    );
    for (const write of writes) {
      expect(write.value).toBe("");
      expect(write.maxAge).toBe(0);
    }
  });

  it("clears each spelling with the flag that spelling requires", () => {
    const writes = clearedSessionCookieWrites();

    // A browser drops a `__Host-` cookie that is not Secure, so clearing it without the flag
    // would silently leave the session in place.
    for (const write of writes) {
      expect(write.secure).toBe(write.name.startsWith("__Host-"));
    }
  });
});
