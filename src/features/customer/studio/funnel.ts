"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import type { DesignIssue } from "@/features/designer/lib/checks";
import { useEditor } from "@/features/designer/store/editor";
import type { AnalyticsProperties } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";

type Step = "studio_started" | "studio_box_confirmed" | "studio_first_artwork" | "studio_checks_clean";

/**
 * The studio funnel (studio-spec §1, D-286; `docs/ux/funnels.md`): each step at most once per page,
 * with the style family and, once ② sets it, the print method — nothing that identifies anyone.
 */
export function useStudioFunnel({
  route,
  styleFamily,
  printMethod,
}: {
  route: string;
  styleFamily?: string;
  printMethod?: AnalyticsProperties["printMethod"];
}) {
  const sent = useRef(new Set<Step>());
  const props = useRef<AnalyticsProperties>({ route });
  useEffect(() => {
    props.current = { route, styleFamily, printMethod };
  }, [route, styleFamily, printMethod]);

  const once = useCallback((step: Step) => {
    if (sent.current.has(step)) return;
    sent.current.add(step);
    track(step, props.current);
  }, []);

  // Started: once the product is known (its family travels with the event), else on open.
  useEffect(() => {
    const timer = setTimeout(() => once("studio_started"), styleFamily ? 0 : 1500);
    return () => clearTimeout(timer);
  }, [once, styleFamily]);

  // First artwork: the first element or background on the sheet.
  useEffect(
    () =>
      useEditor.subscribe((s, prev) => {
        const has = (x: typeof s) => x.content.elements.length > 0 || x.content.pattern.kind !== "none";
        if (has(s) && !has(prev) && s.dirty) once("studio_first_artwork");
      }),
    [once],
  );

  return useMemo(
    () => ({
      boxConfirmed: () => once("studio_box_confirmed"),
      /** Artwork on the sheet and no blocking check (`useChecksClean`). */
      checksClean: () => once("studio_checks_clean"),
    }),
    [once],
  );
}

/** Checks clean: artwork on the sheet and no blocking problem left in the live checks. */
export function useChecksClean(issues: DesignIssue[], onClean: () => void) {
  const errors = issues.filter((issue) => issue.severity === "block").length;
  const hasArtwork = useEditor((s) => s.content.elements.length > 0);
  useEffect(() => {
    if (hasArtwork && errors === 0) onClean();
  }, [errors, hasArtwork, onClean]);
}
