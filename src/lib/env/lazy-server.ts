import "server-only";

/**
 * The server env, read at request time rather than at import time.
 *
 * `src/lib/env/server.ts` validates on module evaluation, and that is the right behaviour for
 * `src/proxy.ts`: it runs on every request, so a missing `API_INTERNAL_URL` fails the whole
 * deployment at boot with every absent key named at once, rather than on whichever page first
 * needed it.
 *
 * Route handlers are different. `next build` imports every route module to collect its
 * config, so a static import here would make a production build demand production secrets —
 * and `pnpm build` with no `.env` would stop working, which F0 deliberately avoided. Deferring
 * the read costs one cached dynamic import on the first request and gives up nothing: the
 * proxy has already validated the same schema before any route is reached.
 */
export async function apiInternalUrl(): Promise<string> {
  const { serverEnv } = await import("./server");
  return serverEnv.API_INTERNAL_URL;
}

/** Load balancers in front of this app that append to `X-Forwarded-For`; see `client-ip.ts`. */
export async function trustedProxyHops(): Promise<number> {
  const { serverEnv } = await import("./server");
  return serverEnv.TRUSTED_PROXY_HOPS;
}

/** The host each zone answers on, for a link that belongs to another zone (notification deep links, D-299). */
export async function zoneHostOf(zone: "customer" | "admin" | "partner"): Promise<string> {
  const { zoneHosts } = await import("./server");
  return zoneHosts[zone];
}

/** Dev only: whether the home page may fill empty photo slots from the local media manifest. */
export async function homePhotosLocalManifest(): Promise<boolean> {
  const { serverEnv } = await import("./server");
  return serverEnv.HOME_PHOTOS_LOCAL_MANIFEST === "1";
}
