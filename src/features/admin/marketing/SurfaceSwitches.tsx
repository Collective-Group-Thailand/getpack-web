"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage, Section, useActor, useCan } from "../console";

/** `loyalty.surfaces` in the setting's order (D-509). `capacityDeals` is admin / worker only (P4-PLAN §0.1 item 2). */
export const SURFACE_FLAGS = [
  "deals",
  "dealsLiff",
  "redeem",
  "tierPerks",
  "capacityDeals",
  "checklist",
  "pointsLiff",
  "quoteRecovery",
] as const;
export type SurfaceFlag = (typeof SURFACE_FLAGS)[number];
type Flags = Record<SurfaceFlag, boolean>;

const flagsOf = (value: unknown): Flags =>
  Object.fromEntries(
    SURFACE_FLAGS.map((flag) => [flag, Boolean((value as Record<string, unknown> | null)?.[flag])]),
  ) as Flags;

/** The flags that differ between two values — what a save changes. */
export const changedFlags = (before: Flags, after: Flags) =>
  SURFACE_FLAGS.filter((flag) => before[flag] !== after[flag]);

/**
 * "การเปิดใช้งานแต่ละส่วน" on `/marketing/loyalty` (loyalty P4, D-509): the eight surface switches, each with what the
 * customer sees when it is off, a reason, and one save that writes a new `loyalty.surfaces` version in force now (the
 * published settings flow; no deploy). The rollout and the budget are separate (their own screens).
 */
export function SurfaceSwitches({ setting }: { setting: Schemas["SettingDto"] }) {
  const t = useTranslations("marketing.surfaces");
  const queryClient = useQueryClient();
  const actor = useActor();
  const canChange = useCan("settings.change") && actor.roles.includes(setting.ownerRole);
  const saved = flagsOf(setting.current?.value ?? null);
  const [draft, setDraft] = useState<Flags>(saved);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const changed = changedFlags(saved, draft);

  const save = async () => {
    if (reason.trim().length < 3) return setError(t("needReason"));
    setError(null);
    setBusy(true);
    try {
      await adminBrowserApis().contract.POST("/v1/admin/settings/{settingId}/versions", {
        params: { path: { settingId: setting.id } },
        body: {
          value: { ...(setting.current?.value as object), ...draft } as never,
          effectiveFrom: new Date().toISOString(),
          reason: reason.trim(),
        },
      });
      toast.success(t("saved"));
      setReason("");
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "setting") });
    } catch (failure) {
      setError(problemMessage(failure, t("failed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title={t("title")}
      description={t("description")}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" asChild>
            <Link href="/marketing/loyalty/rollout">{t("rolloutLink")}</Link>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/marketing/loyalty/budget">{t("budgetLink")}</Link>
          </Button>
        </div>
      }
    >
      <ul className="divide-border border-border rounded-card grid divide-y border md:grid-cols-2 md:divide-y-0">
        {SURFACE_FLAGS.map((flag, index) => (
          <li
            key={flag}
            className={
              "border-border px-4 py-3 md:border-b " +
              (index % 2 === 0 ? "md:border-e" : "") +
              (index >= 6 ? " md:border-b-0" : "")
            }
          >
            <Switch
              label={t(`flags.${flag}.label`)}
              description={draft[flag] ? t(`flags.${flag}.on`) : t(`flags.${flag}.off`)}
              labelPosition="start"
              className="w-full justify-between"
              checked={draft[flag]}
              disabled={!canChange || busy}
              onCheckedChange={(checked) => setDraft({ ...draft, [flag]: checked })}
            />
          </li>
        ))}
      </ul>
      {canChange && changed.length ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label={t("reason")} required className="flex-1" error={error ?? undefined}>
            <Textarea rows={1} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setDraft(saved)} disabled={busy}>
              {t("reset")}
            </Button>
            <Button loading={busy} onClick={() => void save()}>
              {t("save", { count: changed.length })}
            </Button>
          </div>
        </div>
      ) : null}
      <p className="text-muted mt-3 text-xs">{t("effect")}</p>
    </Section>
  );
}
