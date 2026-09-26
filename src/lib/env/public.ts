/**
 * The `NEXT_PUBLIC_*` values exactly as the build inlines them.
 *
 * Every key is read as a **literal** `process.env.NEXT_PUBLIC_*` member expression: that is
 * the only form Next inlines at build time, so `process.env[key]` in a loop would come back
 * `undefined` in the browser. The verbosity is the mechanism.
 */
export function publicEnvSource() {
  return {
    NEXT_PUBLIC_ASSET_BASE_URL: process.env.NEXT_PUBLIC_ASSET_BASE_URL,

    NEXT_PUBLIC_REALTIME_DRIVER: process.env.NEXT_PUBLIC_REALTIME_DRIVER,
    NEXT_PUBLIC_REALTIME_KEY: process.env.NEXT_PUBLIC_REALTIME_KEY,
    NEXT_PUBLIC_REALTIME_CLUSTER: process.env.NEXT_PUBLIC_REALTIME_CLUSTER,
    NEXT_PUBLIC_REALTIME_HOST: process.env.NEXT_PUBLIC_REALTIME_HOST,

    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,

    NEXT_PUBLIC_LIFF_ID: process.env.NEXT_PUBLIC_LIFF_ID,
    NEXT_PUBLIC_GTM_ID: process.env.NEXT_PUBLIC_GTM_ID,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,

    NEXT_PUBLIC_ENV_BADGE: process.env.NEXT_PUBLIC_ENV_BADGE,
  };
}
