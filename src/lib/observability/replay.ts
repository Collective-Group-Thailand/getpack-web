/**
 * Session replay on the key journeys (U5.0, scorecard §4) — off unless a build turns it on.
 *
 * What it is for: finding rage clicks and dead ends in the journeys the UX scorecard gates
 * (configure, design, cart and checkout, claim, reorder). What it must never become: a recording
 * of what a customer typed. So every condition below has to hold, and each is the conservative
 * choice:
 *
 * - **Build flag** `NEXT_PUBLIC_REPLAY_ENABLED=1` and a browser Sentry DSN. Default off. Turning it
 *   on waits for legal counsel and the U2.0 data-terms answer (PROGRESS, U5.0), and for a new
 *   consent version so people who consented before replay existed are asked again.
 * - **Analytics consent** (`pk_consent`, D-144). No consent, no recording — not "masked anyway".
 * - **Allow-listed routes only**, by route *pattern*; recording stops on any other page.
 * - **Everything masked**: all text, all inputs, all media; no request or response bodies.
 * - **Sampled**, so a quota is a choice (`NEXT_PUBLIC_REPLAY_SAMPLE_RATE`, default 10 %).
 *
 * The SDK's replay code is imported only when all of that holds, so it adds nothing to the
 * initial JS of any page (docs/performance-budgets.md).
 */

import type { ConsentState } from "@/lib/analytics/consent";

import { replayEnabled } from "./report";

export { replayEnabled };

/** The key journeys' route patterns (`routePattern`, customer zone, locale excluded). */
export const REPLAY_ROUTES: readonly RegExp[] = [
  /^\/configure\/\[[^\]]+\]$/,
  /^\/design\/\[[^\]]+\]$/,
  /^\/studio\/\[[^\]]+\]$/,
  /^\/cart$/,
  /^\/checkout(\/.*)?$/,
  /^\/account\/orders\/\[orderId\]\/(claim|reorder)$/,
  /^\/liff\/orders\/\[orderId\]\/reorder$/,
];

/** The SDK's options. Masking is total by design; nothing here may be loosened per page. */
export const REPLAY_OPTIONS = {
  maskAllText: true,
  maskAllInputs: true,
  blockAllMedia: true,
  networkDetailAllowUrls: [] as string[],
  networkCaptureBodies: false,
} as const;

export function sampleRate(value: string | undefined = process.env.NEXT_PUBLIC_REPLAY_SAMPLE_RATE): number {
  const rate = Number(value ?? "0.1");
  return Number.isFinite(rate) ? Math.min(1, Math.max(0, rate)) : 0.1;
}

/** Whether this page may be recorded. Pure, so the whole rule is testable in one table. */
export function mayRecord(input: {
  enabled: boolean;
  consent: ConsentState | null;
  route: string;
  sampled: boolean;
}): boolean {
  return (
    input.enabled &&
    input.consent?.analytics === true &&
    input.sampled &&
    REPLAY_ROUTES.some((pattern) => pattern.test(input.route))
  );
}

type Replay = { start: () => void; stop: () => Promise<void> };
let replay: Replay | null = null;

/**
 * Starts or stops the recording. Waits briefly for `instrumentation-client.ts` to initialise
 * Sentry (it loads lazily too), and does nothing if it never does. Never throws: observability
 * must not break the page it observes.
 */
export async function setRecording(on: boolean): Promise<void> {
  if (!replayEnabled) return;
  try {
    if (!on) {
      await replay?.stop();
      return;
    }
    const Sentry = await import("@sentry/nextjs");
    let client = Sentry.getClient();
    for (let tries = 0; !client && tries < 20; tries += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      client = Sentry.getClient();
    }
    if (!client) return;
    if (!replay) {
      const integration = Sentry.replayIntegration(REPLAY_OPTIONS);
      client.addIntegration(integration);
      replay = integration;
    }
    replay.start();
  } catch {
    // Already recording, or the SDK is blocked: either way the page carries on.
  }
}
