import { z } from "zod";

import { isZone, ZONES, type Zone } from "@/lib/zones";

/**
 * Environment shapes for F1 Deliverable 1.1, kept free of `process.env` so they can be
 * unit-tested and so the server and client halves share one vocabulary.
 *
 * Splitting them is a security boundary, not tidiness: only `NEXT_PUBLIC_*` may reach the
 * browser, and `src/lib/env/server.ts` enforces that with `server-only`.
 */

/** `getpack.co` or `admin.localhost:3000` — a Host header value, never a URL. */
const hostValue = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9.-]+(:\d{1,5})?$/, "expected a hostname with an optional port, not a URL");

const httpUrl = z
  .string()
  .trim()
  .refine((value) => {
    try {
      const { protocol } = new URL(value);
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, "expected an absolute http(s) URL");

/** Trailing slashes make every `new URL(path, base)` call site guess; strip them once here. */
const originUrl = httpUrl.transform((value) => value.replace(/\/+$/, ""));

const optionalText = z
  .string()
  .trim()
  .min(1)
  .optional()
  // `KEY=` in a .env file is an empty string, which means "unset", not "set to nothing".
  .or(z.literal("").transform(() => undefined));

/**
 * Comma-separated allow-list of the zones this deployment answers for (00-master-plan.md
 * §2: the same image can be deployed twice with `ZONES` restricting each copy). Unset means
 * all three.
 */
const zoneList = z
  .string()
  .trim()
  .transform((value) =>
    value
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  )
  .refine((zones) => zones.every(isZone), `expected a comma-separated list of ${ZONES.join(", ")}`)
  .transform((zones) => zones as Zone[])
  .optional();

export interface EnvMode {
  /**
   * Development and test get working defaults so `pnpm dev` runs with no `.env`; production
   * gets none, so a forgotten host fails at boot instead of silently 404ing every request.
   */
  isProduction: boolean;
}

export function serverEnvSchema({ isProduction }: EnvMode) {
  return z.object({
    PUBLIC_HOST: isProduction ? hostValue : hostValue.default("localhost:3000"),
    ADMIN_HOST: isProduction ? hostValue : hostValue.default("admin.localhost:3000"),
    PARTNER_HOST: isProduction ? hostValue : hostValue.default("partner.localhost:3000"),

    /** Server-to-server base URL for `getpack-api`; never reaches the browser (ADR-0005). */
    API_INTERNAL_URL: isProduction ? originUrl : originUrl.default("http://localhost:4000"),
    /** Where `pnpm gen:api` reads the contract from (api-conventions.md §1). */
    API_CONTRACT_SOURCE: optionalText,

    ZONES: zoneList,

    /**
     * How many load balancers in front of this app append to `X-Forwarded-For` (0 = none, the
     * default). The visitor's address is the entry that many places from the right, and it is
     * what the BFF and server-side calls forward to getpack-api (`src/lib/security/client-ip.ts`).
     */
    TRUSTED_PROXY_HOPS: z
      .string()
      .trim()
      .regex(/^\d$/, "expected a whole number of proxy hops, 0–9")
      .transform(Number)
      .optional()
      .or(z.literal("").transform(() => undefined))
      .transform((value) => value ?? 0),

    /**
     * Dev only: `1` fills the home page's photo slots the CMS leaves empty from
     * `public/media/home/manifest.json` (local stacks run getpack-api with fake, in-memory file
     * storage, so CMS photos cannot be served there). Refused in production, so a deployment
     * never shows the interim photos.
     */
    HOME_PHOTOS_LOCAL_MANIFEST: isProduction
      ? optionalText.refine(
          (value) => value === undefined,
          "a dev-only fallback (interim photos); must not be set in production",
        )
      : z
          .enum(["0", "1"])
          .optional()
          .or(z.literal("").transform(() => undefined)),

    SENTRY_DSN: optionalText,
    SENTRY_ENVIRONMENT: optionalText,
    SENTRY_RELEASE: optionalText,
  });
}

export function clientEnvSchema() {
  return z.object({
    /** S3/CDN origin for product imagery, artwork thumbnails and proofs. */
    NEXT_PUBLIC_ASSET_BASE_URL: originUrl.optional(),

    /** Realtime carries ids only; the client refetches through the API (conventions §5). */
    NEXT_PUBLIC_REALTIME_DRIVER: z.enum(["sse", "pusher"]).optional(),
    NEXT_PUBLIC_REALTIME_KEY: optionalText,
    NEXT_PUBLIC_REALTIME_CLUSTER: optionalText,
    NEXT_PUBLIC_REALTIME_HOST: hostValue.optional(),

    /** Firebase web config — customer sign-in with Google/Apple (F1 1.2). */
    NEXT_PUBLIC_FIREBASE_API_KEY: optionalText,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: hostValue.optional(),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: optionalText,
    NEXT_PUBLIC_FIREBASE_APP_ID: optionalText,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: optionalText,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: optionalText,

    NEXT_PUBLIC_LIFF_ID: optionalText,
    /** Customer host only — admin and partner ship no third-party analytics (D-102). */
    NEXT_PUBLIC_GTM_ID: optionalText,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: optionalText,

    /**
     * The browser's Sentry DSN. Separate from the server's `SENTRY_DSN` because only
     * `NEXT_PUBLIC_*` reaches the bundle — and because a deployment may well want server
     * errors reported without shipping ~40 KB of SDK to every storefront visitor.
     */
    NEXT_PUBLIC_SENTRY_DSN: optionalText,

    /**
     * Session replay on the key journeys (U5.0, `src/lib/observability/replay.ts`). Off unless
     * `1`, and only with a browser DSN and analytics consent. Do not turn on before counsel and
     * the U2.0 data-terms answer, and a new consent version (PROGRESS, U5.0).
     */
    NEXT_PUBLIC_REPLAY_ENABLED: z.enum(["0", "1"]).optional(),
    /**
     * getpack Assistant (U5.5): its code is built in only when `1`. D-218 keeps it off at launch;
     * even built in, getpack-api decides per customer (`assistant.enabled`, the D-306 gate).
     */
    NEXT_PUBLIC_ASSISTANT: z.enum(["0", "1"]).optional(),
    /** Share of consented visits recorded, 0–1 (default 0.1). */
    NEXT_PUBLIC_REPLAY_SAMPLE_RATE: z
      .string()
      .regex(/^(0(\.\d+)?|1(\.0+)?)$/)
      .optional(),

    /** Shown in the admin topbar so nobody mistakes UAT for production (F1 1.3). */
    NEXT_PUBLIC_ENV_BADGE: z.enum(["uat", "prod"]).optional(),
  });
}

export type ServerEnv = z.infer<ReturnType<typeof serverEnvSchema>>;
export type ClientEnv = z.infer<ReturnType<typeof clientEnvSchema>>;

/**
 * Every problem at once, named by key. A boot failure that reports one missing variable per
 * restart is a bad afternoon; this is the whole list in one message.
 */
export function formatEnvIssues(error: z.ZodError, scope: string): string {
  const lines = error.issues.map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  return `Invalid ${scope} environment:\n${lines.join("\n")}\n\nSee .env.example for every key this app reads.`;
}

export function parseEnv<T extends z.ZodType>(schema: T, source: unknown, scope: string): z.output<T> {
  const result = schema.safeParse(source);
  if (!result.success) throw new Error(formatEnvIssues(result.error, scope));
  return result.data;
}
