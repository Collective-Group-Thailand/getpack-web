import type { VatBasis } from "./price";

/**
 * The reader's "ราคารวม VAT" choice (default: inclusive). A per-browser convenience, so it lives in
 * localStorage behind try/catch (private windows and blocked storage must not break the page); it is
 * not an account setting because the contract has none. Nothing reads it until the API supplies both
 * figures and the switch is drawn.
 */
const KEY = "getpack.vat-basis";

export function readVatPreference(): VatBasis {
  try {
    return window.localStorage.getItem(KEY) === "excl" ? "excl" : "incl";
  } catch {
    return "incl";
  }
}

export function writeVatPreference(basis: VatBasis): void {
  try {
    window.localStorage.setItem(KEY, basis);
  } catch {
    /* storage unavailable: the choice lasts for this page view only */
  }
}
