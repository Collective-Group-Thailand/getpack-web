import { describe, expect, it } from "vitest";

import { clientEnvSchema, parseEnv, serverEnvSchema } from "./schema";

const production = serverEnvSchema({ isProduction: true });
const development = serverEnvSchema({ isProduction: false });

describe("serverEnvSchema", () => {
  it("runs with no .env outside production", () => {
    const env = parseEnv(development, {}, "server");

    expect(env.PUBLIC_HOST).toBe("localhost:3000");
    expect(env.ADMIN_HOST).toBe("admin.localhost:3000");
    expect(env.PARTNER_HOST).toBe("partner.localhost:3000");
    expect(env.API_INTERNAL_URL).toBe("http://localhost:4000");
  });

  it("requires the hosts in production rather than defaulting them", () => {
    // A forgotten ADMIN_HOST that silently fell back to localhost would 404 every admin
    // request in production with nothing in the logs to say why.
    expect(() => parseEnv(production, {}, "server")).toThrow(/PUBLIC_HOST/);
  });

  it("names every problem in one error", () => {
    let message = "";
    try {
      parseEnv(production, { PUBLIC_HOST: "https://getpack.co", API_INTERNAL_URL: "not-a-url" }, "server");
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain("PUBLIC_HOST");
    expect(message).toContain("ADMIN_HOST");
    expect(message).toContain("PARTNER_HOST");
    expect(message).toContain("API_INTERNAL_URL");
  });

  it("trusts no proxy hop unless told how many there are", () => {
    expect(parseEnv(development, {}, "server").TRUSTED_PROXY_HOPS).toBe(0);
    expect(parseEnv(production, { ...productionHosts(), TRUSTED_PROXY_HOPS: "1" }, "server").TRUSTED_PROXY_HOPS).toBe(
      1,
    );
    expect(() => parseEnv(development, { TRUSTED_PROXY_HOPS: "one" }, "server")).toThrow(/TRUSTED_PROXY_HOPS/);
  });

  it("allows the local home-photo fallback only outside production", () => {
    expect(parseEnv(development, { HOME_PHOTOS_LOCAL_MANIFEST: "1" }, "server").HOME_PHOTOS_LOCAL_MANIFEST).toBe("1");
    expect(parseEnv(production, productionHosts(), "server").HOME_PHOTOS_LOCAL_MANIFEST).toBeUndefined();
    expect(() => parseEnv(production, { ...productionHosts(), HOME_PHOTOS_LOCAL_MANIFEST: "1" }, "server")).toThrow(
      /HOME_PHOTOS_LOCAL_MANIFEST/,
    );
    expect(() => parseEnv(production, { ...productionHosts(), HOME_PHOTOS_LOCAL_MANIFEST: "0" }, "server")).toThrow(
      /HOME_PHOTOS_LOCAL_MANIFEST/,
    );
  });

  it("rejects a URL where a Host header value belongs", () => {
    expect(() => parseEnv(development, { ADMIN_HOST: "https://admin.getpack.co" }, "server")).toThrow(/ADMIN_HOST/);
  });

  it("normalises the API base URL so call sites need not guess about trailing slashes", () => {
    const env = parseEnv(development, { API_INTERNAL_URL: "https://api.getpack.co/" }, "server");
    expect(env.API_INTERNAL_URL).toBe("https://api.getpack.co");
  });

  it("reads ZONES as an allow-list and rejects a name that is not a zone", () => {
    expect(parseEnv(development, { ZONES: "customer, admin" }, "server").ZONES).toEqual(["customer", "admin"]);
    expect(parseEnv(development, {}, "server").ZONES).toBeUndefined();
    expect(() => parseEnv(development, { ZONES: "customer,finance" }, "server")).toThrow(/ZONES/);
  });

  it("treats KEY= in a .env file as unset", () => {
    expect(parseEnv(development, { SENTRY_DSN: "" }, "server").SENTRY_DSN).toBeUndefined();
  });
});

describe("clientEnvSchema", () => {
  const schema = clientEnvSchema();

  it("accepts an empty browser environment", () => {
    expect(parseEnv(schema, {}, "client").NEXT_PUBLIC_GTM_ID).toBeUndefined();
  });

  it("constrains the environment badge to the values the admin topbar renders", () => {
    expect(parseEnv(schema, { NEXT_PUBLIC_ENV_BADGE: "uat" }, "client").NEXT_PUBLIC_ENV_BADGE).toBe("uat");
    expect(() => parseEnv(schema, { NEXT_PUBLIC_ENV_BADGE: "staging" }, "client")).toThrow(/NEXT_PUBLIC_ENV_BADGE/);
  });

  it("strips the trailing slash from the asset origin", () => {
    const env = parseEnv(schema, { NEXT_PUBLIC_ASSET_BASE_URL: "https://cdn.getpack.co//" }, "client");
    expect(env.NEXT_PUBLIC_ASSET_BASE_URL).toBe("https://cdn.getpack.co");
  });
});

function productionHosts() {
  return {
    PUBLIC_HOST: "getpack.co",
    ADMIN_HOST: "admin.getpack.co",
    PARTNER_HOST: "partner.getpack.co",
    API_INTERNAL_URL: "https://api.internal.getpack.co",
  };
}
