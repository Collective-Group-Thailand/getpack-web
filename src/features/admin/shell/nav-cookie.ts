/**
 * Whether the back-office sidebar is collapsed, remembered per host.
 *
 * A cookie rather than `localStorage`, for the same reason `pk_theme` is one (ADR-0003): the
 * server needs it before the first byte. Reading it after hydration would render the sidebar
 * open and then snap it shut on every navigation, which is worse than not remembering at all.
 *
 * JS-readable on purpose — it carries no identity, and the toggle writes it without a round
 * trip.
 */
export const NAV_COOKIE = "pk_admin_nav";
export const NAV_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type NavState = "open" | "collapsed";

export function isNavState(value: unknown): value is NavState {
  return value === "open" || value === "collapsed";
}
