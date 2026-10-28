"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, ConfirmAction, FormDialog, FormError, problemMessage, useActor } from "../console";
import type { SoloOwnerMode } from "./presentation";

export const SOLO_OWNER_KEY = queryKeys.detail("admin", "approval_solo_owner_mode", "current");

/** D-449 A: solo-owner mode as the API reports it (`admin.approvalSoloOwnerMode.get`). */
export function useSoloOwnerMode() {
  return useQuery({
    queryKey: SOLO_OWNER_KEY,
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/approval-solo-owner-mode")).data!,
  });
}

/** The badge every approvals screen shows while solo-owner mode is on. */
export function SoloOwnerBadge({ mode }: { mode: SoloOwnerMode | undefined }) {
  const t = useTranslations("approvals.solo");
  const format = useFormat();
  if (!mode?.active) return null;
  return (
    <Badge tone="warning" icon="key">
      {mode.expiresAt ? t("badgeUntil", { date: format.date(mode.expiresAt) }) : t("badge")}
    </Badge>
  );
}

/**
 * D-449 A (owner decision 2026-10-28): solo-owner mode — while on, a Superadmin may approve their own request with a
 * typed reason ("อนุมัติด้วยตนเอง"). Everyone sees its state; only a Superadmin turns it on (expiry up to the configured
 * days, 90) or off — the API is the enforcement point (setting `approvals.solo_owner_mode`, owner Superadmin).
 */
export function SoloOwnerModePanel() {
  const t = useTranslations("approvals.solo");
  const format = useFormat();
  const actor = useActor();
  const queryClient = useQueryClient();
  const mode = useSoloOwnerMode();
  const [turningOn, setTurningOn] = useState(false);
  const [turningOff, setTurningOff] = useState(false);
  // The decision names the role: only a Superadmin changes the mode (the API refuses anyone else).
  const isSuperadmin = actor.roles.includes("superadmin");

  const save = useMutation({
    mutationFn: async (body: { enabled: boolean; expiresAt?: string; reason: string }) =>
      (await adminBrowserApis().contract.PUT("/v1/admin/approval-solo-owner-mode", { body })).data!,
    onSuccess: (data, body) => {
      queryClient.setQueryData(SOLO_OWNER_KEY, data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "approval") });
      toast.success(body.enabled ? t("turnedOn") : t("turnedOff"));
    },
  });

  const data = mode.data;
  if (!data) return null;
  if (!isSuperadmin && !data.active) return null;

  return (
    <section
      aria-labelledby="solo-owner-title"
      className="border-border bg-surface rounded-card flex flex-wrap items-center justify-between gap-3 border p-4"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id="solo-owner-title" className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          {t("title")}
          {data.active ? (
            <Badge tone="warning" icon="key" size="sm">
              {t("on")}
            </Badge>
          ) : (
            <Badge size="sm">{t("off")}</Badge>
          )}
        </h2>
        <p className="text-muted text-sm">
          {data.active && data.expiresAt
            ? t("activeUntil", { date: format.dateTime(data.expiresAt) })
            : data.enabled
              ? t("expired")
              : t("explain")}
        </p>
        {data.changedBy && data.changedAt ? (
          <p className="text-muted text-xs">
            {t("changedBy", { name: data.changedBy.displayName })} · <When at={data.changedAt} />
          </p>
        ) : null}
      </div>
      {isSuperadmin ? (
        data.active ? (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setTurningOn(true)}>
              {t("renew")}
            </Button>
            <Button size="sm" variant="secondary" iconStart="ban" onClick={() => setTurningOff(true)}>
              {t("turnOff")}
            </Button>
          </div>
        ) : (
          <Button size="sm" iconStart="key" onClick={() => setTurningOn(true)}>
            {t("turnOn")}
          </Button>
        )
      ) : null}

      {turningOn ? (
        <TurnOnDialog
          maxDays={data.maxDays}
          onClose={() => setTurningOn(false)}
          onSubmit={(body) => save.mutateAsync({ enabled: true, ...body })}
        />
      ) : null}
      <ConfirmAction
        open={turningOff}
        onOpenChange={(open) => (open ? undefined : setTurningOff(false))}
        title={t("turnOffTitle")}
        description={t("turnOffBody")}
        confirmLabel={t("turnOff")}
        tone="destructive"
        reason={{ label: t("reason"), required: true, minLength: 3, hint: t("reasonHint") }}
        onConfirm={async ({ reason }) => {
          try {
            await save.mutateAsync({ enabled: false, reason: reason.trim() });
          } catch (error) {
            toast.error(problemMessage(error, t("saveFailed")));
            throw error;
          }
        }}
      />
    </section>
  );
}

/** `datetime-local` is Bangkok wall-clock time; the API wants an instant. */
function bangkokInstant(local: string): string {
  return local.length === 16 ? `${local}:00+07:00` : local;
}

function TurnOnDialog({
  maxDays,
  onClose,
  onSubmit,
}: {
  maxDays: number | null;
  onClose: () => void;
  onSubmit: (body: { expiresAt?: string; reason: string }) => Promise<unknown>;
}) {
  const t = useTranslations("approvals.solo");
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");
  return (
    <FormDialog
      title={t("turnOnTitle")}
      description={t("turnOnBody")}
      submitLabel={t("turnOn")}
      onClose={onClose}
      onSubmit={async () => {
        if (reason.trim().length < 3) throw new FormError(t("errors.reason"));
        await onSubmit({ ...(expiresAt ? { expiresAt: bangkokInstant(expiresAt) } : {}), reason: reason.trim() });
      }}
    >
      <Field label={t("expiresAt")} hint={maxDays ? t("expiresHint", { days: maxDays }) : t("expiresHintNoMax")}>
        <Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
      </Field>
      <Field label={t("reason")} hint={t("reasonHint")} required>
        <Input value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </FormDialog>
  );
}
