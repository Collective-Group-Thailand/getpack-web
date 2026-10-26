"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { SETTING_VERSION_STATUS } from "@/domain/status";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
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
import { Input, NumberInput } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  effectiveInstant,
  FormDialog,
  FormError,
  QueryError,
  StatusChip,
  today,
  useCan,
  useProductTypes,
} from "../console";

type Route = Schemas["MilestoneRouteDto"];
type RouteVersion = Schemas["RouteVersionDto"];
type RouteStep = Schemas["RouteStepDto"];
type Evidence = Schemas["EvidenceRequirement"];

const EVIDENCE = ["none", "photo", "qc_form", "photo_and_qc_form"] as const satisfies readonly Evidence[];

interface EditableStep {
  id: string;
  key: string;
  nameTh: string;
  nameEn: string;
  customerLabelTh: string;
  customerLabelEn: string;
  evidence: Evidence;
  plannedSharePct: string;
  tracksQuantity: boolean;
}

let counter = 0;
const rowId = () => `route-step-${(counter++).toString(36)}`;

const toEditable = (step: RouteStep): EditableStep => ({
  id: rowId(),
  key: step.key,
  nameTh: step.nameTh,
  nameEn: step.nameEn,
  customerLabelTh: step.customerLabelTh ?? "",
  customerLabelEn: "",
  evidence: step.evidence,
  plannedSharePct: step.plannedSharePct ?? "",
  tracksQuantity: step.tracksQuantity,
});

/** The version a new job is released on: the latest approved one whose date has come. */
const inForce = (route: Route, now = Date.now()) =>
  route.versions
    .filter((version) => version.status === "approved" && new Date(version.effectiveFrom).getTime() <= now)
    .sort((a, b) => b.versionNo - a.versionNo)[0] ?? null;

/**
 * Milestone routes (D-075): the production steps a job reports, per product type (and print type)
 * and variant, with what evidence each needs and which the customer sees. A change is a new version
 * from a date, never back-dated; jobs already released keep their version.
 */
export function MilestoneRoutes() {
  const t = useTranslations("production.routes");
  const locale = useLocale();
  const format = useFormat();
  const types = useProductTypes();
  const canManage = useCan("milestone_routes.manage");
  const [creating, setCreating] = useState(false);
  const [publishing, setPublishing] = useState<Route | null>(null);
  const routes = useQuery({
    queryKey: queryKeys.list("admin", "milestone_route"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/milestone-routes")).data!,
  });
  if (routes.isError) return <QueryError error={routes.error} onRetry={() => void routes.refetch()} />;
  if (!routes.data) return <Skeleton className="h-64" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted text-sm">{t("body")}</p>
        {canManage ? (
          <Button iconStart="plus" onClick={() => setCreating(true)}>
            {t("create")}
          </Button>
        ) : null}
      </div>
      {routes.data.length === 0 ? <EmptyState icon="route" title={t("empty")} /> : null}
      {routes.data.map((route) => {
        const current = inForce(route);
        const later = route.versions.filter(
          (version) => version !== current && version.versionNo > (current?.versionNo ?? 0),
        );
        return (
          <Card key={route.id} padding="lg">
            <CardHeader className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-1">
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {route.name}
                  <Badge size="sm">{types.labelOf(route.productTypeCode)}</Badge>
                  <span className="text-muted text-xs tabular-nums">{route.variant}</span>
                </CardTitle>
                <p className="text-muted text-sm">
                  {current
                    ? t("current", {
                        no: current.versionNo,
                        date: format.date(current.effectiveFrom),
                        reason: current.reason,
                      })
                    : t("noneInForce")}
                </p>
              </div>
              {canManage ? (
                <Button size="sm" variant="secondary" iconStart="edit" onClick={() => setPublishing(route)}>
                  {t("publish")}
                </Button>
              ) : null}
            </CardHeader>
            {current ? <StepsTable steps={current.steps} locale={locale} /> : null}
            {later.map((version) => (
              <p key={version.versionNo} className="text-muted mt-3 flex flex-wrap items-center gap-2 text-sm">
                <StatusChip map={SETTING_VERSION_STATUS} value={version.status} />
                {t("later", {
                  no: version.versionNo,
                  date: format.dateTime(version.effectiveFrom),
                  steps: version.steps.length,
                })}
              </p>
            ))}
          </Card>
        );
      })}
      {creating ? <CreateRouteDialog onClose={() => setCreating(false)} onDone={() => void routes.refetch()} /> : null}
      {publishing ? (
        <PublishDialog
          route={publishing}
          from={inForce(publishing) ?? publishing.versions.at(-1) ?? null}
          onClose={() => setPublishing(null)}
          onDone={() => void routes.refetch()}
        />
      ) : null}
    </div>
  );
}

function StepsTable({ steps, locale }: { steps: readonly RouteStep[]; locale: string }) {
  const t = useTranslations("production.routes");
  return (
    <div className="border-border overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <caption className="sr-only">{t("steps")}</caption>
        <thead className="bg-surface-subtle text-muted text-xs">
          <tr>
            <th className="px-3 py-2 text-start font-medium">{t("step")}</th>
            <th className="px-3 py-2 text-start font-medium">{t("customerSees")}</th>
            <th className="px-3 py-2 text-start font-medium">{t("evidence")}</th>
            <th className="px-3 py-2 text-end font-medium">{t("share")}</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step) => (
            <tr key={step.seq} className="border-border border-t">
              <td className="px-3 py-2">
                {step.seq}. {locale === "en" ? step.nameEn : step.nameTh}
                <span className="text-muted ms-2 text-xs tabular-nums">{step.key}</span>
                {step.tracksQuantity ? (
                  <Badge size="sm" className="ms-2">
                    {t("tracksQuantity")}
                  </Badge>
                ) : null}
              </td>
              <td className="px-3 py-2">
                {step.customerVisible ? step.customerLabelTh : <span className="text-muted">{t("hidden")}</span>}
              </td>
              <td className="px-3 py-2">{t(`evidenceKinds.${step.evidence}`)}</td>
              <td className="px-3 py-2 text-end tabular-nums">
                {step.plannedSharePct ? `${step.plannedSharePct}%` : t("even")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreateRouteDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useTranslations("production.routes.createDialog");
  const types = useProductTypes();
  const [form, setForm] = useState({ name: "", productTypeCode: "", variant: "" });
  return (
    <FormDialog
      title={t("title")}
      description={t("body")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (!form.productTypeCode) throw new FormError(t("needType"));
        if (!/^[a-z][a-z0-9_]{0,31}$/.test(form.variant)) throw new FormError(t("needVariant"));
        if (!form.name.trim()) throw new FormError(t("needName"));
        await adminBrowserApis().contract.POST("/v1/admin/milestone-routes", {
          body: { name: form.name.trim(), productTypeCode: form.productTypeCode, variant: form.variant },
        });
        toast.success(t("done"));
        onDone();
        onClose();
      }}
    >
      <Field label={t("productType")} required>
        <SearchableSelect
          value={form.productTypeCode || undefined}
          placeholder={t("choose")}
          onValueChange={(productTypeCode) => setForm({ ...form, productTypeCode })}
          options={types.options}
        />
      </Field>
      <Field label={t("variant")} hint={t("variantHint")} required>
        <Input
          value={form.variant}
          onChange={(event) => setForm({ ...form, variant: event.target.value.toLowerCase() })}
        />
      </Field>
      <Field label={t("name")} required>
        <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      </Field>
    </FormDialog>
  );
}

function PublishDialog({
  route,
  from,
  onClose,
  onDone,
}: {
  route: Route;
  from: RouteVersion | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("production.routes.publishDialog");
  const tRoutes = useTranslations("production.routes");
  const [steps, setSteps] = useState<EditableStep[]>(() => (from?.steps ?? []).map(toEditable));
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [reason, setReason] = useState("");
  const set = (id: string, patch: Partial<EditableStep>) =>
    setSteps(steps.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...steps];
    const [step] = next.splice(index, 1);
    next.splice(index + by, 0, step!);
    setSteps(next);
  };
  return (
    <FormDialog
      size="xl"
      title={t("title", { name: route.name })}
      description={t("body")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (steps.length === 0) throw new FormError(t("errors.none"));
        const keys = new Set<string>();
        steps.forEach((step, index) => {
          const n = index + 1;
          if (!/^[a-z][a-z0-9_]{0,63}$/.test(step.key) || keys.has(step.key))
            throw new FormError(t("errors.key", { n }));
          keys.add(step.key);
          if (!step.nameTh.trim() || !step.nameEn.trim()) throw new FormError(t("errors.name", { n }));
          if (step.plannedSharePct.trim() && !/^\d{1,3}(\.\d{1,4})?$/.test(step.plannedSharePct.trim())) {
            throw new FormError(t("errors.share", { n }));
          }
        });
        if (effectiveFrom < today()) throw new FormError(t("errors.backDated"));
        if (reason.trim().length < 3) throw new FormError(t("errors.reason"));
        await adminBrowserApis().contract.POST("/v1/admin/milestone-routes/{routeId}/versions", {
          params: { path: { routeId: route.id } },
          body: {
            effectiveFrom: effectiveInstant(effectiveFrom),
            reason: reason.trim(),
            steps: steps.map((step) => ({
              key: step.key,
              nameTh: step.nameTh.trim(),
              nameEn: step.nameEn.trim(),
              ...(step.customerLabelTh.trim() ? { customerLabelTh: step.customerLabelTh.trim() } : {}),
              ...(step.customerLabelEn.trim() ? { customerLabelEn: step.customerLabelEn.trim() } : {}),
              evidence: step.evidence,
              ...(step.plannedSharePct.trim() ? { plannedSharePct: step.plannedSharePct.trim() } : {}),
              tracksQuantity: step.tracksQuantity,
            })),
          },
        });
        toast.success(t("done"));
        onDone();
        onClose();
      }}
    >
      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => (
          <li key={step.id} className="border-border grid gap-2 rounded-md border p-3 sm:grid-cols-4">
            <Field label={t("key", { n: index + 1 })}>
              <Input value={step.key} onChange={(event) => set(step.id, { key: event.target.value.toLowerCase() })} />
            </Field>
            <Field label={t("nameTh", { n: index + 1 })}>
              <Input value={step.nameTh} onChange={(event) => set(step.id, { nameTh: event.target.value })} />
            </Field>
            <Field label={t("nameEn", { n: index + 1 })}>
              <Input value={step.nameEn} onChange={(event) => set(step.id, { nameEn: event.target.value })} />
            </Field>
            <div className="flex items-end justify-end gap-1">
              <IconButton
                name="chevron-up"
                variant="ghost"
                label={t("up", { n: index + 1 })}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              />
              <IconButton
                name="chevron-down"
                variant="ghost"
                label={t("down", { n: index + 1 })}
                disabled={index === steps.length - 1}
                onClick={() => move(index, 1)}
              />
              <IconButton
                name="trash"
                variant="ghost"
                label={t("remove", { n: index + 1 })}
                onClick={() => setSteps(steps.filter((candidate) => candidate.id !== step.id))}
              />
            </div>
            <Field label={t("customerTh", { n: index + 1 })} hint={t("customerHint")}>
              <Input
                value={step.customerLabelTh}
                onChange={(event) => set(step.id, { customerLabelTh: event.target.value })}
              />
            </Field>
            <Field label={t("customerEn", { n: index + 1 })}>
              <Input
                value={step.customerLabelEn}
                onChange={(event) => set(step.id, { customerLabelEn: event.target.value })}
              />
            </Field>
            <Field label={t("evidence", { n: index + 1 })}>
              <NativeSelect
                value={step.evidence}
                onValueChange={(evidence) => set(step.id, { evidence: evidence as Evidence })}
                options={EVIDENCE.map((value) => ({ value, label: tRoutes(`evidenceKinds.${value}`) }))}
              />
            </Field>
            <Field label={t("share", { n: index + 1 })} hint={t("shareHint")}>
              <NumberInput
                unit="%"
                inputMode="decimal"
                value={step.plannedSharePct}
                onChange={(event) => set(step.id, { plannedSharePct: event.target.value })}
              />
            </Field>
            <Checkbox
              className="sm:col-span-4"
              label={t("tracksQuantity", { n: index + 1 })}
              checked={step.tracksQuantity}
              onCheckedChange={(on) => set(step.id, { tracksQuantity: on === true })}
            />
          </li>
        ))}
      </ol>
      <Button
        size="sm"
        variant="secondary"
        iconStart="plus"
        className="self-start"
        onClick={() =>
          setSteps([
            ...steps,
            {
              id: rowId(),
              key: "",
              nameTh: "",
              nameEn: "",
              customerLabelTh: "",
              customerLabelEn: "",
              evidence: "none",
              plannedSharePct: "",
              tracksQuantity: false,
            },
          ])
        }
      >
        {t("add")}
      </Button>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("effectiveFrom")} hint={t("effectiveHint")} required>
          <Input
            type="date"
            min={today()}
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
          />
        </Field>
        <Field label={t("reason")} required>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </div>
    </FormDialog>
  );
}
