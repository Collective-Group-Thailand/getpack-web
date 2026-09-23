import { cookies } from "next/headers";

import { isThemeChoice, THEME_COOKIE, ZONE_DEFAULT_THEME, type Theme, type ThemeChoice, type Zone } from "./themes";

/**
 * Reads `pk_theme` so a root layout can stamp `<html data-theme>` before the first byte
 * reaches the browser — the whole point of ADR-0003's cookie: no flash, and theming that
 * works with JavaScript disabled.
 *
 * Cost, accepted in F0.2: touching cookies opts the route out of static rendering. In F1
 * `src/proxy.ts` forwards the choice as a request header instead, which lets the page be
 * cached again — see docs/PROGRESS.md.
 */
export async function readThemeChoice(zone: Zone = "customer"): Promise<ThemeChoice> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isThemeChoice(value) ? value : ZONE_DEFAULT_THEME[zone];
}

/** `undefined` means "follow the OS" — see dataThemeAttribute. */
export async function readTheme(zone: Zone = "customer"): Promise<Theme | undefined> {
  const choice = await readThemeChoice(zone);
  return choice === "system" ? undefined : choice;
}
