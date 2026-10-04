"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import VENDORED from "../../../../contract/studio-rules.json";

import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import type { PersistenceMode } from "./persistence";
import type { Schemas } from "@/lib/api/types";

import type { CheckContext } from "../lib/useIssues";

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

/**
 * Everything the live checks need besides the sheet (U4.5): the rule catalogue (the vendored copy
 * at the lock's tag while `store.studio.getRules` has not answered, or in the back office, which
 * has no store surface), the print method, the material class and — for a customer — the studio
 * elements whose legal right is not declared yet.
 */
export function useCheckContext(
  spec: { studio?: { printMethod?: string | null }; material: { kind: string } } | null,
  mode: PersistenceMode,
): CheckContext {
  const rules = useStudioRules(mode !== "admin");
  const elements = useQuery({
    queryKey: [...queryKeys.zone("customer"), "studio-elements"],
    queryFn: async () => (await browserApi().GET("/v1/store/studio/elements")).data!,
    enabled: mode === "store",
    staleTime: 10 * 60_000,
  });
  const undeclared = useMemo(
    () => new Set((elements.data ?? []).filter((e) => e.requiresRight && !e.usable).map((e) => e.id)),
    [elements.data],
  );
  const printMethod = spec?.studio?.printMethod ?? null;
  const materialClass = spec?.material.kind ?? null;
  const catalogue = rules.data?.rules;
  return useMemo(
    () => ({
      rules: (catalogue ?? (VENDORED.rules as PrintRule[])) as CheckContext["rules"],
      printMethod,
      materialClass,
      undeclared,
    }),
    [catalogue, printMethod, materialClass, undeclared],
  );
}

export type SoftProofProfile = Schemas["SoftProofProfileDto"];

/**
 * How a simplified soft-proof transform (D-215, D-279) is shown on screen: a CSS filter over the
 * stage (`saturate`, `brightness`, `contrast` as factors) and the substrate laid over it in
 * multiply (`multiply` a colour, `multiplyOpacity` 0–1) — kraft's absorption, a white board's
 * slight dullness. Keys a profile does not set leave that part alone.
 */
export function softProofStyle(profile: SoftProofProfile | null): {
  filter?: string;
  overlay?: { background: string; opacity: number };
} {
  if (!profile) return {};
  const n = (key: string) => {
    const v = profile.transform[key];
    const x = typeof v === "string" ? Number(v) : v;
    return typeof x === "number" && Number.isFinite(x) ? x : null;
  };
  const parts = [
    n("saturate") !== null ? `saturate(${n("saturate")})` : "",
    n("brightness") !== null ? `brightness(${n("brightness")})` : "",
    n("contrast") !== null ? `contrast(${n("contrast")})` : "",
  ].filter(Boolean);
  const multiply = profile.transform.multiply;
  return {
    ...(parts.length ? { filter: parts.join(" ") } : {}),
    ...(typeof multiply === "string" && /^#[0-9a-f]{6}$/i.test(multiply)
      ? { overlay: { background: multiply, opacity: n("multiplyOpacity") ?? 0.35 } }
      : {}),
  };
}
