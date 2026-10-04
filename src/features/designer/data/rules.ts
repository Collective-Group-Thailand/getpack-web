"use client";

import { useQuery } from "@tanstack/react-query";

import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";

export type StudioRules = Schemas["StudioRulesDto"];
export type PrintRule = Schemas["PrintRuleDto"];

/**
 * `store.studio.getRules` (D-278): the one catalogue the studio and the server check with. The back
 * office has no store surface, so a staff copy is checked with the catalogue's own artwork rules.
 */
export function useStudioRules(enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.zone("customer"), "studio-rules"],
    queryFn: async () => (await browserApi().GET("/v1/store/studio/rules")).data!,
    staleTime: 10 * 60_000,
    enabled,
  });
}

/** A threshold of a rule that is on, as a number, or `null`. */
export function threshold(rules: StudioRules | undefined, id: string, key: string, printMethod: string | null = null) {
  const value = ruleFor(rules, id, printMethod)?.thresholds?.[key];
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** A rule that is on (its thresholds set) and applies to this print method (`null` = all). */
export function ruleFor(rules: StudioRules | undefined, id: string, printMethod: string | null): PrintRule | null {
  const rule = rules?.rules.find((r) => r.id === id);
  if (!rule || rule.thresholds === null) return null;
  if (rule.printMethods && (!printMethod || !rule.printMethods.includes(printMethod as never))) return null;
  return rule;
}

/** The flexo spot-colour limit Prepress set (`spot_colour_count.maxColours`), or `null` while unset. */
export function maxSpotColours(rules: StudioRules | undefined): number | null {
  const value = ruleFor(rules, "spot_colour_count", "flexo")?.thresholds?.maxColours;
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}
