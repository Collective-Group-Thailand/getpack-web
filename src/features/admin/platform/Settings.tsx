"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { SETTING_CONFIRMATION_STATUS, SETTING_VERSION_STATUS, statusMeta } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  problemMessage,
  QueryError,
  useActor,
  useCan,
  useRoleLabel,
} from "../console";
import { describeValue, type Setting, type SettingDetail, type SettingValue } from "./setting-value";
import { SettingField, SettingValueView, useSettingWords } from "./settings/SettingField";
import { plainDescription, sameValue } from "./settings/shape";

/** A setting's value, the way the business reads it — masked values stay masked. */
function ValueText({
  value,
  setting,
}: {
  value: SettingValue | null | undefined;
  setting: Pick<Setting, "key" | "valueType" | "masked">;
}) {
  return <SettingValueView setting={setting} value={value} compact />;
}

/** `datetime-local` text for "now", in Bangkok wall-clock time — getpack's only clock. */
function bangkokNowInput(): string {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 16);
}

export function SettingDetailView({ settingId, initial }: { settingId: string; initial: SettingDetail | null }) {
  const t = useTranslations("platform.settings");
  const tStatus = useTranslations("status");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const roleLabel = useRoleLabel();
  const actor = useActor();
  const canChange = useCan("settings.change");
  const queryClient = useQueryClient();
  const key = queryKeys.detail("admin", "setting", settingId);

  const words = useSettingWords();
  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/settings/{settingId}", { params: { path: { settingId } } }))
        .data!,
    initialData: initial ?? undefined,
  });

  const [draft, setDraft] = useState<{ value: SettingValue | null; valid: boolean } | null>(null);
  const [generation, setGeneration] = useState(0);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: async (value: SettingValue) =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/settings/{settingId}/versions", {
          params: { path: { settingId } },
          body: {
            value,
            reason: reason.trim(),
            // "Now" is sent as the current instant; the API refuses anything in the past.
            effectiveFrom: when === "now" ? new Date().toISOString() : `${effectiveFrom}:00+07:00`,
          },
        })
      ).data!,
    onSuccess: (updated) => {
      queryClient.setQueryData(key, updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "setting") });
      toast.success(
        updated.pending ? t("change.changePending") : when === "now" ? t("change.changed") : t("change.scheduled"),
      );
      setDraft(null);
      setGeneration((g) => g + 1);
      setReason("");
      setError(null);
    },
  });

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const setting = query.data;
  if (!setting) return null;

  const owner = actor.roles.includes(setting.ownerRole);
  const editable = canChange && owner && !setting.masked && !setting.pending;
  const later = when === "later" && effectiveFrom !== "";
  const ready = draft !== null && draft.valid && reason.trim().length >= 3 && (when === "now" || later);
  const confirmation = statusMeta(SETTING_CONFIRMATION_STATUS, setting.confirmationStatus);
  const plain = (value: SettingValue | null | undefined) =>
    setting.valueType === "boolean"
      ? t(value ? "true" : "false")
      : setting.valueType === "json"
        ? t("change.structured")
        : (describeValue(value, setting.valueType, format) ?? "—");
  const newText = draft?.valid ? plain(draft.value) : "";

  const historyColumns: DataTableColumn<SettingDetail["versions"][number]>[] = [
    { id: "versionNo", header: t("history.version"), numeric: true, cell: (row) => row.versionNo },
    { id: "value", header: t("history.value"), cell: (row) => <ValueText value={row.value} setting={setting} /> },
    {
      id: "effectiveFrom",
      header: t("history.effectiveFrom"),
      cell: (row) => <When at={row.effectiveFrom} absoluteOnly />,
    },
    {
      id: "status",
      header: t("history.status"),
      cell: (row) => {
        const meta = statusMeta(SETTING_VERSION_STATUS, row.status);
        return <StatusBadge size="sm" meta={meta} label={tStatus(meta.labelKey)} />;
      },
    },
    { id: "reason", header: t("history.reason"), cell: (row) => row.reason },
    { id: "createdAt", header: t("history.createdAt"), cell: (row) => <When at={row.createdAt} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: "/settings", label: t("title") }}
        title={words.label(setting.key)}
        meta={
          <>
            <code className="bg-surface-subtle rounded-thumb text-muted px-1.5 py-0.5 font-mono text-xs">
              {setting.key}
            </code>
            {setting.confirmationStatus !== "confirmed" ? (
              <StatusBadge meta={confirmation} label={tStatus(confirmation.labelKey)} />
            ) : null}
          </>
        }
        description={words.help(setting.key) ?? plainDescription(setting.description)}
      />

      <DetailLayout
        aside={
          <ActionPanel
            id="setting-change"
            tone="neutral"
            title={t("change.title")}
            description={
              !editable
                ? setting.pending
                  ? t("change.pendingExists")
                  : setting.masked
                    ? t("change.masked")
                    : t("change.notOwner", { role: roleLabel(setting.ownerRole) })
                : undefined
            }
          >
            {editable ? (
              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (ready) setConfirming(true);
                }}
              >
                {error ? <Callout tone="danger" title={error} /> : null}
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium">{t("change.newValue")}</p>
                  <SettingField
                    key={generation}
                    setting={setting}
                    value={draft ? draft.value : (setting.current?.value ?? null)}
                    onChange={(value, valid) =>
                      setDraft(valid && sameValue(value, setting.current?.value ?? null) ? null : { value, valid })
                    }
                  />
                </div>
                <Field label={t("change.effective")}>
                  <SegmentedControl
                    label={t("change.effective")}
                    value={when}
                    onValueChange={setWhen}
                    options={[
                      { value: "now", label: t("change.now") },
                      { value: "later", label: t("change.later") },
                    ]}
                  />
                </Field>
                {when === "later" ? (
                  <Field
                    label={t("change.effectiveFrom")}
                    hint={t("change.effectiveHint")}
                    required
                    requiredLabel={tCommon("state.required")}
                  >
                    <Input
                      type="datetime-local"
                      min={bangkokNowInput()}
                      value={effectiveFrom}
                      onChange={(event) => setEffectiveFrom(event.target.value)}
                    />
                  </Field>
                ) : null}
                <Field
                  label={t("change.reason")}
                  hint={t("change.reasonHint")}
                  required
                  requiredLabel={tCommon("state.required")}
                >
                  <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
                </Field>
                {setting.approvalPolicy ? (
                  <Callout tone="info" title={t("change.needsApproval", { policy: setting.approvalPolicy })} />
                ) : null}
                <Button type="submit" disabled={!ready} className="w-full">
                  {t("change.review")}
                </Button>
              </form>
            ) : null}
          </ActionPanel>
        }
      >
        {setting.confirmationStatus !== "confirmed" ? (
          <Callout tone="warning" title={t(`confirmationHint.${setting.confirmationStatus}`)} />
        ) : null}

        <section aria-labelledby="setting-in-force" className="flex flex-col gap-3">
          <h2 id="setting-in-force" className="text-lg font-semibold">
            {t("inForce")}
          </h2>
          <div className="border-border bg-surface rounded-card flex flex-col gap-4 border p-4 sm:p-5">
            <SettingValueView setting={setting} value={setting.current?.value ?? null} />
            <DescriptionList
              items={[
                { term: t("since"), description: <When at={setting.current?.effectiveFrom} absoluteOnly /> },
                { term: t("owner"), description: roleLabel(setting.ownerRole) },
                { term: t("approval"), description: setting.approvalPolicy ?? t("noApproval") },
                { term: t("decisions"), description: setting.decisionRefs.join(", ") || "—" },
              ]}
            />
          </div>
        </section>

        {setting.scheduled.length > 0 || setting.pending ? (
          <section aria-labelledby="setting-upcoming" className="flex flex-col gap-3">
            <h2 id="setting-upcoming" className="text-lg font-semibold">
              {t("upcoming")}
            </h2>
            <ul className="border-border bg-surface divide-border rounded-card divide-y border text-sm">
              {setting.pending ? (
                <li className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <Badge tone="warning" icon="hourglass">
                    {t("pendingBadge")}
                  </Badge>
                  <ValueText value={setting.pending.value} setting={setting} />
                  <span className="text-muted">{t("from")}</span>
                  <When at={setting.pending.effectiveFrom} absoluteOnly />
                </li>
              ) : null}
              {setting.scheduled.map((version) => (
                <li key={version.versionNo} className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <Badge tone="info" icon="calendar">
                    {t("scheduledBadge")}
                  </Badge>
                  <ValueText value={version.value} setting={setting} />
                  <span className="text-muted">{t("from")}</span>
                  <When at={version.effectiveFrom} absoluteOnly />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="setting-history" className="flex flex-col gap-3">
          <div>
            <h2 id="setting-history" className="text-lg font-semibold">
              {t("history.title")}
            </h2>
            <p className="text-muted text-sm">{t("history.hint")}</p>
          </div>
          <DataTable
            caption={t("history.title")}
            columns={historyColumns}
            rows={setting.versions}
            getRowId={(row) => String(row.versionNo)}
            density="compact"
          />
        </section>
      </DetailLayout>

      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        title={t("change.confirmTitle", { key: words.label(setting.key) })}
        description={t("change.confirmBody", {
          from: plain(setting.current?.value),
          to: newText,
          when: when === "now" ? t("change.now") : format.dateTime(`${effectiveFrom}:00+07:00`),
        })}
        confirmLabel={when === "now" ? t("change.applyNow") : t("change.schedule")}
        confirmationPhrase={setting.key}
        onConfirm={async () => {
          if (!draft?.valid) return;
          try {
            await change.mutateAsync(draft.value as SettingValue);
          } catch (failure) {
            setError(isApiError(failure) ? failure.detail : problemMessage(failure, t("change.failed")));
            throw failure;
          }
        }}
      />
    </div>
  );
}
