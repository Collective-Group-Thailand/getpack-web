/**
 * C7 (DECISIONS-STAGE-A §2, D-455): the back-office form of the setting `studio.featured_styles` — the admins' ordered
 * style list for the Studio's "แบบที่คนเริ่มบ่อย" (each on/off) and when to switch to real usage.
 */
export interface StudioFeaturedValue {
  styles: { code: string; enabled: boolean }[];
  usage: { minDesigns: number | null; windowDays: number };
}

export interface StudioFeaturedForm {
  styles: { code: string; enabled: boolean }[];
  /** Text as typed; empty = never switch to usage. */
  minDesigns: string;
  windowDays: string;
}

/** The setting's limits (prisma/seed/data/settings.ts): 12 styles, a code like PK-TE-01, 7–365 days. */
export const MAX_STYLES = 12;
export const CODE = /^[A-Z0-9][A-Z0-9-]{2,39}$/;
/** The window a new list starts with: the style library's "popular" window (D-245, 90 days). */
export const DEFAULT_WINDOW_DAYS = 90;

export function formOf(value: StudioFeaturedValue | null | undefined): StudioFeaturedForm {
  return {
    styles: value?.styles.map((s) => ({ ...s })) ?? [],
    minDesigns: value?.usage.minDesigns != null ? String(value.usage.minDesigns) : "",
    windowDays: String(value?.usage.windowDays ?? DEFAULT_WINDOW_DAYS),
  };
}

export type FormError = "code" | "duplicate" | "tooMany" | "minDesigns" | "windowDays";

/** The setting value, or the first problem. */
export function valueOf(
  form: StudioFeaturedForm,
): { ok: true; value: StudioFeaturedValue } | { ok: false; error: FormError } {
  if (form.styles.length > MAX_STYLES) return { ok: false, error: "tooMany" };
  if (form.styles.some((s) => !CODE.test(s.code))) return { ok: false, error: "code" };
  if (new Set(form.styles.map((s) => s.code)).size !== form.styles.length) return { ok: false, error: "duplicate" };
  const min = form.minDesigns.trim();
  if (min !== "" && !/^\d{1,7}$/.test(min)) return { ok: false, error: "minDesigns" };
  if (min !== "" && Number(min) < 1) return { ok: false, error: "minDesigns" };
  const days = form.windowDays.trim();
  if (!/^\d{1,3}$/.test(days) || Number(days) < 7 || Number(days) > 365) return { ok: false, error: "windowDays" };
  return {
    ok: true,
    value: {
      styles: form.styles.map((s) => ({ code: s.code, enabled: s.enabled })),
      usage: { minDesigns: min === "" ? null : Number(min), windowDays: Number(days) },
    },
  };
}

/** Moves the style at `index` one place up (-1) or down (+1). */
export function move<T>(list: T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to]!, next[index]!];
  return next;
}
