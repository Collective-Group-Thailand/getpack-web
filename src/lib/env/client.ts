import { publicEnvSource } from "./public";
import type { ClientEnv } from "./schema";

/**
 * Browser-safe environment, without zod.
 *
 * The values are inlined at build time, so the server can check them — and does, at boot, with
 * `clientEnvSchema` (`./server.ts`): a bad value still fails fast, before any page is served.
 * The browser only normalises what the schema would (trim, "" = unset, host lower-cased, no
 * trailing slash on an origin). Parsing here shipped all of zod in every page's initial
 * JavaScript (F2 2.8: ~90 KB gz of the admin shell).
 */
function text(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const source = publicEnvSource();
const host = (value: string | undefined) => text(value)?.toLowerCase();

export const clientEnv: ClientEnv = {
  NEXT_PUBLIC_ASSET_BASE_URL: text(source.NEXT_PUBLIC_ASSET_BASE_URL)?.replace(/\/+$/, ""),
  NEXT_PUBLIC_REALTIME_DRIVER: text(source.NEXT_PUBLIC_REALTIME_DRIVER) as ClientEnv["NEXT_PUBLIC_REALTIME_DRIVER"],
  NEXT_PUBLIC_REALTIME_KEY: text(source.NEXT_PUBLIC_REALTIME_KEY),
  NEXT_PUBLIC_REALTIME_CLUSTER: text(source.NEXT_PUBLIC_REALTIME_CLUSTER),
  NEXT_PUBLIC_REALTIME_HOST: host(source.NEXT_PUBLIC_REALTIME_HOST),
  NEXT_PUBLIC_FIREBASE_API_KEY: text(source.NEXT_PUBLIC_FIREBASE_API_KEY),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: host(source.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: text(source.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  NEXT_PUBLIC_FIREBASE_APP_ID: text(source.NEXT_PUBLIC_FIREBASE_APP_ID),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: text(source.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: text(source.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  NEXT_PUBLIC_LIFF_ID: text(source.NEXT_PUBLIC_LIFF_ID),
  NEXT_PUBLIC_LINE_OA_ID: text(source.NEXT_PUBLIC_LINE_OA_ID),
  NEXT_PUBLIC_GTM_ID: text(source.NEXT_PUBLIC_GTM_ID),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: text(source.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
  NEXT_PUBLIC_SENTRY_DSN: text(source.NEXT_PUBLIC_SENTRY_DSN),
  NEXT_PUBLIC_ENV_BADGE: text(source.NEXT_PUBLIC_ENV_BADGE) as ClientEnv["NEXT_PUBLIC_ENV_BADGE"],
};
