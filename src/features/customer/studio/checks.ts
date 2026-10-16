"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { DesignIssue, PrintRule } from "@/features/designer/lib/checks";
import { useEditor } from "@/features/designer/store/editor";
import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";

export type CheckRun = Schemas["CheckRunDto"];

/** A finding's key: the rule and the element (`""` for the design as a whole). */
export const findingKey = (ruleId: string, elementId: string) => `${ruleId}:${elementId}`;

/**
 * The checks getpack-api keeps for a saved version (U4.5, D-278): `store.studio.runChecks` evaluates
 * the document with the same rule ids the studio uses and stores the run; a warning it found is
 * accepted with `acknowledgeCheck` (who, when). A warning only the studio can see (the die's
 * geometry) is accepted in the design itself (`content.acknowledged`), so it too is kept with the
 * version. Blocks are never accepted: they are fixed.
 */
export function useStudioChecks(
  designId: string | null,
  versionNo: number | null,
  rules: PrintRule[],
  enabled: boolean,
  /** The version the server has now (it can move on while a finding is being accepted). */
  currentVersion: () => number | null,
) {
  const client = useQueryClient();
  const keyOf = (version: number | null) => [...queryKeys.zone("customer"), "studio-checks", designId, version];
  const fetchRun = (version: number) => async () =>
    (
      await browserApi().POST("/v1/store/studio/{designId}/checks", {
        params: { path: { designId: designId! } },
        body: { versionNo: version },
      })
    ).data!;
  const run = useQuery({
    queryKey: keyOf(versionNo),
    queryFn: fetchRun(versionNo!),
    enabled: enabled && !!designId && !!versionNo,
    // A version never changes, so its run is asked for once (and never twice at the same time:
    // getpack-api answers concurrent runs of a version with a 500 — docs/integration.md).
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  });
  const onServer = useCallback(
    (ruleId: string) => rules.find((r) => r.id === ruleId)?.evaluatedOn.includes("document") ?? false,
    [rules],
  );
  const content = useEditor((s) => s.content);

  /** Accepted on the server: on the version it has now, whose run is fetched (once) first. */
  const acknowledgeOnServer = useMutation({
    mutationFn: async (issue: DesignIssue) => {
      const version = currentVersion();
      if (!designId || !version) throw new Error("not saved");
      const latest = await client.fetchQuery({
        queryKey: keyOf(version),
        queryFn: fetchRun(version),
        staleTime: Infinity,
      });
      const found = latest.findings.some(
        (f) => f.ruleId === issue.ruleId && (f.elementId ?? "") === issue.elementId && f.severity === "warn",
      );
      if (!found) return { version, run: null };
      const { data } = await browserApi().POST("/v1/store/studio/{designId}/checks/acknowledgements", {
        params: { path: { designId } },
        body: { ruleId: issue.ruleId, versionNo: version, ...(issue.elementId ? { elementId: issue.elementId } : {}) },
      });
      return { version, run: data! };
    },
    onSuccess: ({ version, run: next }, issue) => {
      if (next) client.setQueryData(keyOf(version), next);
      // getpack-api did not find it on the saved version (the design moved on): kept with the design.
      else acknowledgeInDesign(issue);
    },
    onError: (_error, issue) => acknowledgeInDesign(issue),
  });

  const acknowledged = (issue: DesignIssue) => {
    const k = findingKey(issue.ruleId, issue.elementId);
    if (content.acknowledged?.includes(k)) return true;
    const runs = [run.data, client.getQueryData<CheckRun>(keyOf(currentVersion()))];
    return runs.some(
      (r) =>
        r?.findings.some(
          (f) => f.ruleId === issue.ruleId && (f.elementId ?? "") === issue.elementId && f.acknowledged,
        ) ?? false,
    );
  };

  const acknowledge = (issue: DesignIssue) => {
    if (onServer(issue.ruleId) && designId) acknowledgeOnServer.mutate(issue);
    else acknowledgeInDesign(issue);
  };

  /**
   * Before ordering (U4.6): the version to be ordered carries every acceptance — the warnings the
   * customer accepted on an earlier version (or in the design) are accepted again on this one where
   * getpack-api finds them, so its run of the version is `ready`.
   */
  const carryAcknowledgements = async (version: number, issues: DesignIssue[]) => {
    if (!designId) return;
    const latest = await client.fetchQuery({
      queryKey: keyOf(version),
      queryFn: fetchRun(version),
      staleTime: Infinity,
    });
    let run = latest;
    for (const issue of issues) {
      if (issue.severity !== "warn" || !onServer(issue.ruleId) || !acknowledged(issue)) continue;
      const finding = run.findings.find((f) => f.ruleId === issue.ruleId && (f.elementId ?? "") === issue.elementId);
      if (!finding || finding.acknowledged) continue;
      const { data } = await browserApi().POST("/v1/store/studio/{designId}/checks/acknowledgements", {
        params: { path: { designId } },
        body: { ruleId: issue.ruleId, versionNo: version, ...(issue.elementId ? { elementId: issue.elementId } : {}) },
      });
      run = data!;
    }
    client.setQueryData(keyOf(version), run);
    return run;
  };

  return { run, acknowledged, acknowledge, carryAcknowledgements };
}

function acknowledgeInDesign(issue: DesignIssue) {
  useEditor.getState().commit((c) => ({
    ...c,
    acknowledged: [...new Set([...(c.acknowledged ?? []), findingKey(issue.ruleId, issue.elementId)])],
  }));
}
