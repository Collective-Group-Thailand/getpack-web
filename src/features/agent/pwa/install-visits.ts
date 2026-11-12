/**
 * When getpack Agent offers to be installed (D-467): from the second visit on, until the person says no. A visit is
 * one browser session (counted once per tab session); "not now" is remembered on this device. Pure over a storage,
 * so the rule is tested without a browser.
 */
export const VISITS_KEY = "getpack.agent.visits";
export const SESSION_KEY = "getpack.agent.visit-counted";
export const DISMISSED_KEY = "getpack.agent.install-dismissed";
export const PROMPT_FROM_VISIT = 2;

export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Counts this visit (once per session) and returns the total. */
export function countVisit(local: KeyValue, session: KeyValue): number {
  const visits = Number.parseInt(local.getItem(VISITS_KEY) ?? "0", 10) || 0;
  if (session.getItem(SESSION_KEY)) return visits;
  session.setItem(SESSION_KEY, "1");
  local.setItem(VISITS_KEY, String(visits + 1));
  return visits + 1;
}

export function shouldOffer({
  visits,
  dismissed,
  installed,
}: {
  visits: number;
  dismissed: boolean;
  installed: boolean;
}) {
  return !installed && !dismissed && visits >= PROMPT_FROM_VISIT;
}
