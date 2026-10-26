"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { Checkbox } from "@/ui/components/Checkbox";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Skeleton } from "@/ui/components/Skeleton";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  effectiveInstant,
  FormDialog,
  FormError,
  QueryError,
  today,
  useCan,
  useProductTypes,
} from "../console";
import { useRefreshPricing } from "./lookups";
import {
  checkSchedule,
  CUSTOMER_TYPES,
  DUE_TRIGGERS,
  emptyInstalment,
  REQUIRED_BEFORE,
  toApiInstalments,
  toApiRule,
  toEditableInstalment,
  toEditableRule,
  type EditableInstalment,
  type EditableRule,
} from "./schedules";

type Template = Schemas["TemplateDto"];

/** A template's selection rule in words: "order ≥ ฿100,000 · juristic · on credit". */
function useRuleText() {
  const t = useTranslations("pricing.schedules.rule");
  const tTypes = useTranslations("pricing.customerTypes");
  const format = useFormat();
  const types = useProductTypes();
  const bound = (value: string) =>
    value.startsWith("setting:") ? t("setting", { key: value.slice("setting:".length) }) : format.thb(value);
  return (template: Template) => {
    const rule = toEditableRule(template.selectionRule);
    const parts = [
      rule.gte ? t("gte", { amount: bound(rule.gte) }) : null,
      rule.lt ? t("lt", { amount: bound(rule.lt) }) : null,
      rule.customerTypes.length ? rule.customerTypes.map((type) => tTypes(type)).join(", ") : null,
      rule.productTypeCodes.length ? rule.productTypeCodes.map(types.labelOf).join(", ") : null,
      rule.creditApproved === "any" ? null : t(rule.creditApproved === "yes" ? "credit" : "noCredit"),
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : t("always");
  };
}

/**
 * Payment schedule templates (D-020): which instalments an order group is split into, picked by
 * priority and selection rule at checkout. A change is a new version from a date — never back-dated
 * — and groups already placed keep their schedule.
 */
export function PaymentSchedules() {
  const t = useTranslations("pricing.schedules");
  const tTrigger = useTranslations("pricing.dueTriggers");
  const tBefore = useTranslations("pricing.requiredBefore");
  const locale = useLocale();
  const format = useFormat();
  const ruleText = useRuleText();
  const canManage = useCan("payment_schedule_templates.manage");
  const [editing, setEditing] = useState<Template | null>(null);
  const templates = useQuery({
    queryKey: queryKeys.list("admin", "payment_schedule_template"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/payment-schedule-templates")).data!,
  });

  if (templates.isError) return <QueryError error={templates.error} onRetry={() => void templates.refetch()} />;
  if (!templates.data) return <Skeleton className="h-64" />;
  if (templates.data.length === 0) return <EmptyState icon="calendar" title={t("empty")} />;

  const ordered = [...templates.data].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-sm">{t("body")}</p>
      {ordered.map((template) => (
        <Card key={template.key} padding="lg">
          <CardHeader className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="flex flex-wrap items-center gap-2">
                {locale === "en" ? template.nameEn : template.nameTh}
                <span className="text-muted text-xs tabular-nums">{template.key}</span>
                {template.versionNo ? (
                  <Badge size="sm">{t("version", { no: template.versionNo })}</Badge>
                ) : (
                  <Badge size="sm" tone="warning" icon="warning">
                    {t("noVersion")}
                  </Badge>
                )}
                {template.requiresPermissionToSelect ? (
                  <Badge size="sm" tone="info" icon="lock">
                    {t("permissionOnly")}
                  </Badge>
                ) : null}
              </CardTitle>
              <p className="text-muted text-sm">
                {t("selection", {
                  priority: template.priority === null ? "–" : template.priority,
                  rule: ruleText(template),
                })}
              </p>
            </div>
            {canManage ? (
              <Button size="sm" variant="secondary" iconStart="edit" onClick={() => setEditing(template)}>
                {t("newVersion")}
              </Button>
            ) : null}
          </CardHeader>
          <ol className="flex flex-col gap-2">
            {template.instalments.map((instalment, index) => (
              <li
                key={index}
                className="border-border flex flex-wrap items-baseline justify-between gap-2 border-t pt-2 text-sm"
              >
                <span className="font-medium">
                  {index + 1}. {locale === "en" ? instalment.labelEn : instalment.labelTh}
                </span>
                <span className="text-muted">
                  {tTrigger(instalment.dueTrigger, { days: instalment.dueOffsetDays ?? 0 })} ·{" "}
                  {tBefore(instalment.requiredBefore)}
                </span>
                <span className="font-semibold tabular-nums">{format.percent(instalment.pct)}</span>
              </li>
            ))}
          </ol>
        </Card>
      ))}
      {editing ? <TemplateVersionDialog template={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function TemplateVersionDialog({ template, onClose }: { template: Template; onClose: () => void }) {
  const t = useTranslations("pricing.scheduleVersion");
  const tTrigger = useTranslations("pricing.dueTriggers");
  const tBefore = useTranslations("pricing.requiredBefore");
  const tTypes = useTranslations("pricing.customerTypes");
  const locale = useLocale();
  const types = useProductTypes();
  const refresh = useRefreshPricing();
  const [instalments, setInstalments] = useState<EditableInstalment[]>(() =>
    template.instalments.length ? template.instalments.map(toEditableInstalment) : [emptyInstalment()],
  );
  const [rule, setRule] = useState<EditableRule>(() => toEditableRule(template.selectionRule));
  const [priority, setPriority] = useState(String(template.priority ?? 100));
  const [restricted, setRestricted] = useState(template.requiresPermissionToSelect);
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [reason, setReason] = useState("");
  const check = checkSchedule(instalments, rule);
  const set = (key: string, patch: Partial<EditableInstalment>) =>
    setInstalments(instalments.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const toggle = <T extends string>(list: T[], value: T, on: boolean) =>
    on ? [...list, value] : list.filter((item) => item !== value);

  return (
    <FormDialog
      size="xl"
      title={t("title", { name: locale === "en" ? template.nameEn : template.nameTh })}
      description={t("body")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (check.problems.length)
          throw new FormError(check.problems.map((problem) => t(`errors.${problem}`)).join(" "));
        if (!/^\d{1,4}$/.test(priority.trim())) throw new FormError(t("errors.priority"));
        if (effectiveFrom < today()) throw new FormError(t("errors.backDated"));
        if (reason.trim().length < 3) throw new FormError(t("errors.reason"));
        await adminBrowserApis().contract.POST("/v1/admin/payment-schedule-templates/{key}/versions", {
          params: { path: { key: template.key } },
          body: {
            effectiveFrom: effectiveInstant(effectiveFrom),
            instalments: toApiInstalments(instalments),
            priority: Number(priority),
            requiresPermissionToSelect: restricted,
            selectionRule: toApiRule(rule),
            reason: reason.trim(),
          },
        });
        refresh();
        toast.success(t("done"));
        onClose();
      }}
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">{t("instalments")}</legend>
        {instalments.map((row, index) => (
          <div key={row.key} className="border-border grid gap-2 rounded-md border p-3 sm:grid-cols-6">
            <Field label={t("labelTh", { n: index + 1 })} className="sm:col-span-2">
              <Input value={row.labelTh} onChange={(event) => set(row.key, { labelTh: event.target.value })} />
            </Field>
            <Field label={t("labelEn", { n: index + 1 })} className="sm:col-span-2">
              <Input value={row.labelEn} onChange={(event) => set(row.key, { labelEn: event.target.value })} />
            </Field>
            <Field label={t("pct", { n: index + 1 })}>
              <NumberInput
                unit="%"
                inputMode="decimal"
                value={row.pct}
                onChange={(event) => set(row.key, { pct: event.target.value })}
              />
            </Field>
            <div className="flex items-end justify-end">
              <IconButton
                name="trash"
                variant="ghost"
                label={t("remove", { n: index + 1 })}
                onClick={() => setInstalments(instalments.filter((candidate) => candidate.key !== row.key))}
              />
            </div>
            <Field label={t("due", { n: index + 1 })} className="sm:col-span-2">
              <NativeSelect
                value={row.dueTrigger}
                onValueChange={(dueTrigger) =>
                  set(row.key, { dueTrigger: dueTrigger as EditableInstalment["dueTrigger"] })
                }
                options={DUE_TRIGGERS.map((value) => ({ value, label: tTrigger(value, { days: "N" }) }))}
              />
            </Field>
            {row.dueTrigger === "days_after_delivery" ? (
              <Field label={t("days", { n: index + 1 })}>
                <NumberInput
                  min={0}
                  max={365}
                  value={row.dueOffsetDays}
                  onChange={(event) => set(row.key, { dueOffsetDays: event.target.value })}
                />
              </Field>
            ) : null}
            <Field label={t("gates", { n: index + 1 })} className="sm:col-span-2">
              <NativeSelect
                value={row.requiredBefore}
                onValueChange={(requiredBefore) =>
                  set(row.key, { requiredBefore: requiredBefore as EditableInstalment["requiredBefore"] })
                }
                options={REQUIRED_BEFORE.map((value) => ({ value, label: tBefore(value) }))}
              />
            </Field>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            iconStart="plus"
            onClick={() => setInstalments([...instalments, emptyInstalment()])}
          >
            {t("add")}
          </Button>
          <span
            className={check.problems.includes("total") ? "text-danger text-sm" : "text-success text-sm"}
            aria-live="polite"
          >
            {t("total", { total: check.total })}
          </span>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">{t("rule")}</legend>
        <p className="text-muted text-xs">{t("ruleHint")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("gte")} hint={t("boundHint")}>
            <Input value={rule.gte} onChange={(event) => setRule({ ...rule, gte: event.target.value })} />
          </Field>
          <Field label={t("lt")} hint={t("boundHint")}>
            <Input value={rule.lt} onChange={(event) => setRule({ ...rule, lt: event.target.value })} />
          </Field>
          <Field label={t("credit")}>
            <NativeSelect
              value={rule.creditApproved}
              onValueChange={(creditApproved) =>
                setRule({ ...rule, creditApproved: creditApproved as EditableRule["creditApproved"] })
              }
              options={(["any", "yes", "no"] as const).map((value) => ({ value, label: t(`creditOptions.${value}`) }))}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-4" role="group" aria-label={t("customerTypes")}>
          <span className="text-sm">{t("customerTypes")}</span>
          {CUSTOMER_TYPES.map((type) => (
            <Checkbox
              key={type}
              label={tTypes(type)}
              checked={rule.customerTypes.includes(type)}
              onCheckedChange={(on) =>
                setRule({ ...rule, customerTypes: toggle(rule.customerTypes, type, on === true) })
              }
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-4" role="group" aria-label={t("productTypes")}>
          <span className="text-sm">{t("productTypes")}</span>
          {types.options.map((type) => (
            <Checkbox
              key={type.value}
              label={type.label}
              checked={rule.productTypeCodes.includes(type.value)}
              onCheckedChange={(on) =>
                setRule({ ...rule, productTypeCodes: toggle(rule.productTypeCodes, type.value, on === true) })
              }
            />
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("priority")} hint={t("priorityHint")} required>
          <NumberInput min={0} value={priority} onChange={(event) => setPriority(event.target.value)} />
        </Field>
        <Field label={t("effectiveFrom")} hint={t("effectiveHint")} required>
          <Input
            type="date"
            min={today()}
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
          />
        </Field>
      </div>
      <Switch
        label={t("restricted")}
        description={t("restrictedHint")}
        checked={restricted}
        onCheckedChange={setRestricted}
      />
      <Field label={t("reason")} required>
        <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </FormDialog>
  );
}
