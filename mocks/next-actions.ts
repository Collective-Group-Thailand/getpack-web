/**
 * packio-api's `nextActions` builder (`src/common/next-actions/next-actions.ts` at v0.6.0), for the
 * mocks: a rule offers one action when its permissions are all held and its `when` — the endpoint's
 * own state check — is `true`; a string offers it disabled with that reason (a message key).
 *
 * Each mock copies its module's rule table (`src/modules/<module>/<x>-actions.ts`) and builds the
 * entity's list from the same state its action handlers check, so a button the screen shows is one
 * the handler accepts.
 */

import type { Schemas } from "@/lib/api/types";

export interface ActionRule<T> {
  key: string;
  permissions?: readonly string[];
  irreversible?: boolean;
  when: (entity: T) => boolean | string;
}

/** The actions an actor holding `can` may take on `entity`, in rule order. */
export function nextActions<T>(
  entity: T,
  rules: readonly ActionRule<T>[],
  can: (permission: string) => boolean,
): Schemas["NextActionDto"][] {
  const out: Schemas["NextActionDto"][] = [];
  for (const rule of rules) {
    if (!(rule.permissions ?? []).every(can)) continue;
    const verdict = rule.when(entity);
    if (verdict === false) continue;
    out.push({
      key: rule.key,
      irreversible: rule.irreversible ?? false,
      disabledReason: typeof verdict === "string" ? verdict : null,
    });
  }
  return out;
}
