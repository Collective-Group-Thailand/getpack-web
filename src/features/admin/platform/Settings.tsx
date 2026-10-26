"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { SETTING_CONFIRMATION_STATUS, SETTING_VERSION_STATUS, statusMeta } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { JsonView } from "@/ui/components/JsonView";
import { PageHeader } from "@/ui/components/PageHeader";
import { SearchInput } from "@/ui/components/SearchInput";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

import {
  adminBrowserApis,
  ConfirmAction,
  problemMessage,
  QueryError,
  useActor,
  useCan,
  useRoleLabel,
} from "../console";
import {
  describeValue,
  parseDraft,
  settingGroup,
  toDraft,
  type Setting,
  type SettingDetail,
  type SettingValue,
} from "./setting-value";

/** A setting's value, the way the business reads it — masked values stay masked. */
function ValueText({
  value,
  setting,
}: {
  value: SettingValue | null | undefined;
  setting: Pick<Setting, "valueType" | "masked">;
}) {
  const t = useTranslations("platform.settings");
  const format = useFormat();
  if (setting.masked) {
    return (
      <span className="text-muted inline-flex items-center gap-1">
        <Icon name="lock" size={14} />
        {t("masked")}
      </span>
    );
  }
  if (setting.valueType === "json") return <JsonView value={value} label={t("value")} className="max-h-32" />;
  if (setting.valueType === "boolean") return <>{value ? t("true") : t("false")}</>;
  return <span className="tabular-nums">{describeValue(value, setting.valueType, format) ?? "—"}</span>;
}

/**
 * Every configurable business value (ADR-0005, D-063): what is in force now, what is scheduled
 * and what is waiting for approval — grouped by the part of the business it governs.
 */
export function SettingsList({ initial }: { initial: Setting[] | null }) {
  const t = useTranslations("platform.settings");
  const tStatus = useTranslations("status");
  const [q, setQ] = useState("");

  const settings = useQuery({
    queryKey: queryKeys.list("admin", "setting"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/settings")).data!,
    initialData: initial ?? undefined,
    staleTime: STALE_TIME.stable,
  });

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matching = (settings.data ?? []).filter(
      (setting) =>
        !needle ||
        setting.key.includes(needle) ||
        setting.description.toLowerCase().includes(needle) ||
        setting.decisionRefs.some((ref) => ref.toLowerCase().includes(needle)),
    );
    const byGroup = new Map<string, Setting[]>();
    for (const setting of matching)
      byGroup.set(settingGroup(setting.key), [...(byGroup.get(settingGroup(setting.key)) ?? []), setting]);
    return [...byGroup.entries()];
  }, [settings.data, q]);

  if (settings.isError) return <QueryError error={settings.error} onRetry={() => void settings.refetch()} />;

  const columns: DataTableColumn<Setting>[] = [
    {
      id: "key",
      header: t("columns.key"),
      className: "w-1/3",
      cell: (row) => (
        <div>
          <Link href={`/settings/${row.id}`} className="text-primary text-xs font-medium tabular-nums hover:underline">
            {row.key}
          </Link>
          <p className="text-muted mt-0.5 text-xs">{row.description}</p>
        </div>
      ),
    },
    {
      id: "value",
      header: t("columns.current"),
      cell: (row) => <ValueText value={row.current?.value} setting={row} />,
    },
    {
      id: "state",
      header: t("columns.state"),
      cell: (row) => {
        const meta = statusMeta(SETTING_CONFIRMATION_STATUS, row.confirmationStatus);
        return (
          <span className="flex flex-wrap gap-1">
            <StatusBadge size="sm" meta={meta} label={tStatus(meta.labelKey)} />
            {row.scheduled.length > 0 ? (
              <Badge size="sm" tone="info" icon="calendar">
                {t("scheduledCount", { count: row.scheduled.length })}
              </Badge>
            ) : null}
            {row.pending ? (
              <Badge size="sm" tone="warning" icon="hourglass">
                {t("pendingBadge")}
              </Badge>
            ) : null}
          </span>
        );
      },
    },
    {
      id: "decisions",
      header: t("columns.decisions"),
      cell: (row) => <span className="text-muted text-xs">{row.decisionRefs.join(", ")}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Field label={t("search")} className="max-w-sm">
        <SearchInput
          value={q}
          onValueChange={setQ}
          clearLabel={t("clearSearch")}
          placeholder={t("searchPlaceholder")}
        />
      </Field>
      {groups.map(([group, rows]) => (
        <section key={group} aria-labelledby={`settings-${group}`} className="flex flex-col gap-2">
          <h2 id={`settings-${group}`} className="text-base font-semibold">
            {t.has(`groups.${group}`) ? t(`groups.${group}`) : group}
          </h2>
          <DataTable
            caption={t.has(`groups.${group}`) ? t(`groups.${group}`) : group}
            columns={columns}
            rows={rows}
            getRowId={(row) => row.id}
            density="compact"
          />
        </section>
      ))}
      {!settings.isPending && groups.length === 0 ? <p className="text-muted text-sm">{t("noMatch")}</p> : null}
    </div>
  );
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

  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/settings/{settingId}", { params: { path: { settingId } } }))
        .data!,
    initialData: initial ?? undefined,
  });

  const [draft, setDraft] = useState<string | null>(null);
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
      setReason("");
      setError(null);
    },
  });

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const setting = query.data;
  if (!setting) return null;

  const owner = actor.roles.includes(setting.ownerRole);
  const editable = canChange && owner && !setting.masked && !setting.pending;
  const current = draft ?? toDraft(setting.current?.value, setting.valueType);
  const parsed = parseDraft(current, setting.valueType);
  const later = when === "later" && effectiveFrom !== "";
  const ready = parsed.ok && reason.trim().length >= 3 && (when === "now" || later);
  const confirmation = statusMeta(SETTING_CONFIRMATION_STATUS, setting.confirmationStatus);
  const plain = (value: SettingValue | null | undefined) =>
    setting.valueType === "boolean"
      ? t(value ? "true" : "false")
      : (describeValue(value, setting.valueType, format) ?? "—");
  const newText = parsed.ok ? plain(parsed.value) : "";

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
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("title"), href: "/settings" }, { label: setting.key }]}
          />
        }
        title={<span className="text-xl tabular-nums">{setting.key}</span>}
        meta={<StatusBadge meta={confirmation} label={tStatus(confirmation.labelKey)} />}
        description={setting.description}
      />

      {setting.confirmationStatus !== "confirmed" ? (
        <Callout tone="warning" title={t(`confirmationHint.${setting.confirmationStatus}`)} />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          <Card padding="lg">
            <CardHeader>
              <CardTitle>{t("inForce")}</CardTitle>
            </CardHeader>
            <DescriptionList
              items={[
                {
                  term: t("value"),
                  description: <ValueText value={setting.current?.value} setting={setting} />,
                  wide: setting.valueType === "json",
                },
                { term: t("since"), description: <When at={setting.current?.effectiveFrom} absoluteOnly /> },
                { term: t("owner"), description: roleLabel(setting.ownerRole) },
                { term: t("approval"), description: setting.approvalPolicy ?? t("noApproval") },
                { term: t("decisions"), description: setting.decisionRefs.join(", ") || "—" },
              ]}
            />
          </Card>

          {setting.scheduled.length > 0 || setting.pending ? (
            <Card padding="lg">
              <CardHeader>
                <CardTitle>{t("upcoming")}</CardTitle>
              </CardHeader>
              <ul className="space-y-2 text-sm">
                {setting.pending ? (
                  <li className="flex flex-wrap items-center gap-2">
                    <Badge tone="warning" icon="hourglass">
                      {t("pendingBadge")}
                    </Badge>
                    <ValueText value={setting.pending.value} setting={setting} />
                    <span className="text-muted">{t("from")}</span>
                    <When at={setting.pending.effectiveFrom} absoluteOnly />
                  </li>
                ) : null}
                {setting.scheduled.map((version) => (
                  <li key={version.versionNo} className="flex flex-wrap items-center gap-2">
                    <Badge tone="info" icon="calendar">
                      {t("scheduledBadge")}
                    </Badge>
                    <ValueText value={version.value} setting={setting} />
                    <span className="text-muted">{t("from")}</span>
                    <When at={version.effectiveFrom} absoluteOnly />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card padding="lg">
            <CardHeader>
              <CardTitle>{t("history.title")}</CardTitle>
            </CardHeader>
            <p className="text-muted mb-3 text-sm">{t("history.hint")}</p>
            <DataTable
              caption={t("history.title")}
              columns={historyColumns}
              rows={setting.versions}
              getRowId={(row) => String(row.versionNo)}
              density="compact"
            />
          </Card>
        </div>

        <Card padding="lg" className="self-start">
          <CardHeader>
            <CardTitle>{t("change.title")}</CardTitle>
          </CardHeader>
          {!editable ? (
            <p className="text-muted text-sm">
              {setting.pending
                ? t("change.pendingExists")
                : setting.masked
                  ? t("change.masked")
                  : t("change.notOwner", { role: roleLabel(setting.ownerRole) })}
            </p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (ready) setConfirming(true);
              }}
            >
              {error ? <Callout tone="danger" title={error} /> : null}
              <Field
                label={t("change.newValue")}
                hint={t(`change.hints.${setting.valueType}`)}
                error={draft !== null && !parsed.ok ? t(`change.errors.${parsed.error}`) : undefined}
              >
                {setting.valueType === "boolean" ? (
                  <SegmentedControl
                    label={t("change.newValue")}
                    value={current === "true" ? "true" : "false"}
                    onValueChange={setDraft}
                    options={[
                      { value: "true", label: t("true") },
                      { value: "false", label: t("false") },
                    ]}
                  />
                ) : setting.valueType === "json" || setting.valueType === "time_of_day_window" ? (
                  <Textarea
                    className="text-xs tabular-nums"
                    rows={6}
                    value={current}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                ) : (
                  <Input
                    inputMode={setting.valueType === "string" || setting.valueType === "enum" ? "text" : "decimal"}
                    type={setting.valueType === "date" ? "date" : "text"}
                    value={current}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                )}
              </Field>
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
          )}
        </Card>
      </div>

      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        title={t("change.confirmTitle", { key: setting.key })}
        description={t("change.confirmBody", {
          from: plain(setting.current?.value),
          to: newText,
          when: when === "now" ? t("change.now") : format.dateTime(`${effectiveFrom}:00+07:00`),
        })}
        confirmLabel={when === "now" ? t("change.applyNow") : t("change.schedule")}
        confirmationPhrase={setting.key}
        onConfirm={async () => {
          if (!parsed.ok) return;
          try {
            await change.mutateAsync(parsed.value);
          } catch (failure) {
            setError(isApiError(failure) ? failure.detail : problemMessage(failure, t("change.failed")));
            throw failure;
          }
        }}
      />
    </div>
  );
}
