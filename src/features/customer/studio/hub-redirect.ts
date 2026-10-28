import type { Query } from "@/features/customer/designer/seed";

/**
 * What makes `/studio/new` an editor entry: a box (`style`), a template, an order's item, a product or pattern to
 * draw for (the configurator's "ออกแบบในสตูดิโอ" before a size is known) — or `step=box`, the blank editor's setup.
 */
const EDITOR_KEYS = ["style", "template", "order", "item", "pattern", "product"] as const;

/**
 * C7 (studio Phase 0 §4.1): `/studio/new` with nothing the editor can draw redirects to the one hub, `/studio`,
 * keeping every other parameter (`start`, `material`, `utm_*`) and dropping `step` — `?start=product`
 * then scrolls the hub to its inline finder. Returns the hub URL, or `null` when the editor should open.
 */
export function hubRedirectOf(query: Query): string | null {
  if (EDITOR_KEYS.some((key) => query[key] !== undefined) || query.step === "box") return null;
  const kept = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === "step" || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) kept.append(key, v);
  }
  const rest = kept.toString();
  return rest ? `/studio?${rest}` : "/studio";
}
