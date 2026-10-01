import type { Schemas } from "@/lib/api/types";

type NextAction = Schemas["NextActionDto"];

/**
 * The action the API offered on an entity (`nextActions`, U-B0.3), or `undefined`. A partner screen
 * shows a form or button only for what is offered — the API decides, the screen never re-derives it
 * from the status (ADR-0005).
 */
export const offered = (actions: readonly NextAction[] | undefined, key: string): NextAction | undefined =>
  actions?.find((action) => action.key === key);

/** The words for why an offered action is blocked: `disabledReason` is a problem code when one exists. */
export function blockedReason(
  action: NextAction | undefined,
  t: { (key: string): string; has(key: string): boolean },
): string | null {
  const reason = action?.disabledReason;
  if (!reason) return null;
  return t.has(reason) ? t(reason) : reason;
}
