import { createBffHandler } from "@/lib/bff";

/**
 * getpack Agent's BFF (ADR-0005, D-467).
 *
 * The browser calls `/bff/*` on this zone's host; `src/proxy.ts` rewrites that onto this
 * route. Only the agent surface, customer sign-in and the few store paths listed for the zone are forwarded — see `ZONE_CONFIG` — so a token stolen from
 * one zone cannot reach another zone's API through this app.
 */
const handle = createBffHandler("agent");

export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;

// No OPTIONS: the BFF is same-origin only, so there is no preflight to answer, and a missing
// handler replies 405 — the right answer to a cross-origin probe.

// A streamed download or SSE feed must not be collected into a static response.
export const dynamic = "force-dynamic";
