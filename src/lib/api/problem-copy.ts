import type { ApiError } from "./problem";

/** The `problems` namespace translator, as far as this needs it (next-intl's `t` and `t.has`). */
export interface ProblemTranslator {
  (key: string): string;
  has(key: string): boolean;
}

export interface ProblemCopy {
  /** This app's th/en title for the code (`src/i18n/messages/{th,en}/common/problems.json`). */
  title: string;
  /**
   * The API's own sentence, localised by `Accept-Language` and carrying the values (how many
   * OTP attempts are left, which status blocked it). `null` for the BFF's refusals, whose
   * detail is terse English for whoever is debugging, not for the person on the screen.
   */
  detail: string | null;
}

/**
 * The words for a problem: a stable title per `code`, and the API's detail beneath it. `null`
 * when the code has no copy — a code the contract does not document for any operation this zone
 * calls, which `src/i18n/problems.test.ts` keeps from happening — so the caller falls back to
 * its own generic wording instead of showing a raw code.
 */
export function problemCopy(error: ApiError, t: ProblemTranslator): ProblemCopy | null {
  if (!error.code || !t.has(error.code)) return null;
  return {
    title: t(error.code),
    detail: error.code.startsWith("bff.") ? null : error.detail || null,
  };
}
