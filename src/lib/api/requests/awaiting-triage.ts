import { OPERATION_TRIAGE } from "./triage";

/**
 * Contract requests written after packio-api's last triage (`triage.ts`, `TRIAGE_SOURCE`).
 *
 * The triage says, per operation, whether packio-api published it, published it in another shape,
 * or builds it in a U-B0 group. A request added since has no verdict yet; it is listed here so
 * `registry.test.ts` can tell "not triaged yet" from "forgotten", and it leaves as soon as
 * `pnpm gen:triage` brings in a verdict for it.
 */
export const AWAITING_TRIAGE: readonly string[] = [];

/**
 * Whether packio-api still has to build this operation — the ones `contract-requests.openapi.json`
 * carries. A published operation (as asked or in another shape) is the backend's contract now,
 * even while a screen still calls it through its request definition.
 */
export function isStillOpen(key: string): boolean {
  const triage = OPERATION_TRIAGE[key];
  return triage ? triage.verdict === "implement" : AWAITING_TRIAGE.includes(key);
}
