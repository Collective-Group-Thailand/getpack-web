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
      parseEnv(production, { PUBLIC_HOST: "https://packio.co.th", API_INTERNAL_URL: "not-a-url" }, "server");
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain("PUBLIC_HOST");
    expect(message).toContain("ADMIN_HOST");
    expect(message).toContain("PARTNER_HOST");
    expect(message).toContain("API_INTERNAL_URL");
  });

  it("rejects a URL where a Host header value belongs", () => {
    expect(() => parseEnv(development, { ADMIN_HOST: "https://admin.packio.co.th" }, "server")).toThrow(/ADMIN_HOST/);
  });

  it("normalises the API base URL so call sites need not guess about trailing slashes", () => {
    const env = parseEnv(development, { API_INTERNAL_URL: "https://api.packio.co.th/" }, "server");
    expect(env.API_INTERNAL_URL).toBe("https://api.packio.co.th");
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
    const env = parseEnv(schema, { NEXT_PUBLIC_ASSET_BASE_URL: "https://cdn.packio.co.th//" }, "client");
    expect(env.NEXT_PUBLIC_ASSET_BASE_URL).toBe("https://cdn.packio.co.th");
  });
});
