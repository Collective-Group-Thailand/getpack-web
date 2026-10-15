"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { useState } from "react";

import { When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  FormDialog,
  FormError,
  problemMessage,
  QueryError,
  Section,
  useCan,
} from "../console";

type PriceRule = Schemas["StylePriceRuleDto"];
type ProcessRule = Schemas["StyleProcessRuleDto"];
type CalculatorKey = Schemas["CalculatorKey"];
type Effect = Schemas["StyleOptionPriceEffect"];
type Scope = Schemas["StyleProcessScope"];

const CALCULATORS = [
  "folding",
  "corrugate",
  "label",
  "tag_sleeve",
  "pouch",
  "standard_product",
  "service",
] as const satisfies readonly CalculatorKey[];
const SCOPES = ["source_product_type", "category", "family", "option"] as const satisfies readonly Scope[];

/** The library's axes and values, as the storefront words them (`styles.axes`, `styles.values`). */
function useAxes() {
  const messages = useMessages() as {
    styles?: { axes?: Record<string, string>; values?: Record<string, Record<string, string>> };
  };
  const axes = messages.styles?.axes ?? {};
  const values = messages.styles?.values ?? {};
  return Object.entries(axes).map(([axis, label]) => ({
    axis,
    label,
    values: Object.entries(values[axis] ?? {}).map(([value, valueLabel]) => ({ value, label: valueLabel })),
  }));
}

/**
 * The rules that turn the library into prices and factories (D-266, D-244, D-411): an option's
 * price rule per calculator — `neutral` (priced as the base) or `configuration` (a patch to the
 * calculator's input) — decides whether a variant prices instantly; a process rule says which
 * factory process a style needs (by product type, category, family or option), which decides who
 * can make it. Retiring a price rule and removing a process rule recompute the library.
 */
export function StyleRules() {
  return (
    <div className="flex flex-col gap-5">
      <PriceRules />
      <ProcessRules />
    </div>
  );
}

function PriceRules() {
  const t = useTranslations("styleLibrary.rules.price");
  const tStyles = useTranslations("styles");
  const queryClient = useQueryClient();
  const canManage = useCan("styles.price_rules");
  const axes = useAxes();
  const [calculator, setCalculator] = useState<CalculatorKey | "all">("all");
  const [status, setStatus] = useState<"active" | "retired">("active");
  const [creating, setCreating] = useState(false);
  const [retiring, setRetiring] = useState<PriceRule | null>(null);
  const [draft, setDraft] = useState({
    calculatorKey: "folding" as CalculatorKey,
    axis: "",
    value: "",
    effect: "neutral" as Effect,
    patch: "",
    note: "",
  });
  const key = queryKeys.list("admin", "style_price_rule", { calculator, status });
  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/style-price-rules", {
          params: { query: { status, ...(calculator === "all" ? {} : { calculatorKey: calculator }) } },
        })
      ).data!,
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "style_price_rule") });
  const axisLabel = (axis: string) => (tStyles.has(`axes.${axis}`) ? tStyles(`axes.${axis}`) : axis);
  const valueLabel = (axis: string, value: string) =>
    tStyles.has(`values.${axis}.${value}`) ? tStyles(`values.${axis}.${value}`) : value;
  const chosenAxis = axes.find((a) => a.axis === draft.axis);

  const columns: DataTableColumn<PriceRule>[] = [
    { id: "calculator", header: t("calculator"), cell: (row) => t(`calculators.${row.calculatorKey}`) },
    {
      id: "option",
      header: t("option"),
      cell: (row) => (
        <span>
          {axisLabel(row.axis)}: <span className="font-medium">{valueLabel(row.axis, row.value)}</span>
          <span className="text-muted ms-1 font-mono text-xs">
            {row.axis}:{row.value}
          </span>
        </span>
      ),
    },
    {
      id: "effect",
      header: t("effect"),
      cell: (row) => (
        <div>
          <Badge tone={row.effect === "neutral" ? "neutral" : "info"} size="sm">
            {t(`effects.${row.effect}`)}
          </Badge>
          {row.patch ? (
            <pre className="text-muted mt-1 text-xs whitespace-pre-wrap">{JSON.stringify(row.patch)}</pre>
          ) : null}
        </div>
      ),
    },
    { id: "note", header: t("note"), cell: (row) => <span className="text-sm">{row.note}</span> },
    {
      id: "created",
      header: t("date"),
      cell: (row) => <When at={row.retiredAt ?? row.createdAt} />,
    },
    ...(canManage && status === "active"
      ? [
          {
            id: "actions",
            header: t("actions"),
            cell: (row: PriceRule) => (
              <Button size="sm" variant="ghost" onClick={() => setRetiring(row)}>
                {t("retire")}
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <Section
      title={t("title")}
      description={t("intro")}
      actions={
        canManage ? (
          <Button iconStart="plus" onClick={() => setCreating(true)}>
            {t("create")}
          </Button>
        ) : null
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field label={t("calculator")} className="min-w-48">
          <Select
            value={calculator}
            onValueChange={(value) => setCalculator(value as CalculatorKey | "all")}
            options={[
              { value: "all", label: t("allCalculators") },
              ...CALCULATORS.map((c) => ({ value: c, label: t(`calculators.${c}`) })),
            ]}
          />
        </Field>
        <Field label={t("status")} className="min-w-40">
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as "active" | "retired")}
            options={[
              { value: "active", label: t("active") },
              { value: "retired", label: t("retired") },
            ]}
          />
        </Field>
      </div>
      {query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          caption={t("title")}
          columns={columns}
          rows={query.data ?? []}
          getRowId={(row) => row.id}
          loading={query.isPending}
          empty={<EmptyState icon="calculator" title={t("empty")} description={t("emptyHint")} />}
        />
      )}

      {creating ? (
        <FormDialog
          title={t("create")}
          description={t("createIntro")}
          submitLabel={t("save")}
          onClose={() => setCreating(false)}
          onSubmit={async () => {
            if (!draft.axis || !draft.value || draft.note.trim().length < 3) throw new FormError(t("incomplete"));
            let patch: Record<string, unknown> | undefined;
            if (draft.effect === "configuration") {
              try {
                patch = JSON.parse(draft.patch || "{}") as Record<string, unknown>;
              } catch {
                throw new FormError(t("patchInvalid"));
              }
            }
            await adminBrowserApis().contract.POST("/v1/admin/style-price-rules", {
              body: {
                calculatorKey: draft.calculatorKey,
                axis: draft.axis,
                value: draft.value,
                effect: draft.effect,
                note: draft.note.trim(),
                ...(patch ? { patch } : {}),
              },
            });
            toast.success(t("added"));
            refresh();
          }}
        >
          <Field label={t("calculator")} required>
            <Select
              value={draft.calculatorKey}
              onValueChange={(value) => setDraft((d) => ({ ...d, calculatorKey: value as CalculatorKey }))}
              options={CALCULATORS.map((c) => ({ value: c, label: t(`calculators.${c}`) }))}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("axis")} required>
              <Select
                value={draft.axis || undefined}
                placeholder={t("chooseAxis")}
                onValueChange={(value) => setDraft((d) => ({ ...d, axis: value, value: "" }))}
                options={axes.map((a) => ({ value: a.axis, label: a.label }))}
              />
            </Field>
            <Field label={t("value")} required>
              <Select
                value={draft.value || undefined}
                placeholder={t("chooseValue")}
                disabled={!chosenAxis}
                onValueChange={(value) => setDraft((d) => ({ ...d, value }))}
                options={(chosenAxis?.values ?? []).map((v) => ({ value: v.value, label: v.label }))}
              />
            </Field>
          </div>
          <Field label={t("effect")} required hint={t(`effectHints.${draft.effect}`)}>
            <Select
              value={draft.effect}
              onValueChange={(value) => setDraft((d) => ({ ...d, effect: value as Effect }))}
              options={(["neutral", "configuration"] as const).map((e) => ({ value: e, label: t(`effects.${e}`) }))}
            />
          </Field>
          {draft.effect === "configuration" ? (
            <Field label={t("patch")} hint={t("patchHint")}>
              <Textarea
                rows={4}
                className="font-mono text-sm"
                value={draft.patch}
                onChange={(e) => setDraft((d) => ({ ...d, patch: e.target.value }))}
              />
            </Field>
          ) : null}
          <Field label={t("note")} required hint={t("noteHint")}>
            <Input value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
          </Field>
        </FormDialog>
      ) : null}

      <ConfirmAction
        open={retiring !== null}
        onOpenChange={(open) => (open ? undefined : setRetiring(null))}
        title={t("retireTitle")}
        description={
          retiring
            ? t("retireBody", {
                option: `${axisLabel(retiring.axis)} ${valueLabel(retiring.axis, retiring.value)}`,
                calculator: t(`calculators.${retiring.calculatorKey}`),
              })
            : ""
        }
        confirmLabel={t("retire")}
        tone="destructive"
        reason={{ label: t("reason"), required: true, minLength: 3 }}
        onConfirm={async ({ reason }) => {
          await adminBrowserApis()
            .contract.POST("/v1/admin/style-price-rules/{ruleId}/actions/retire", {
              params: { path: { ruleId: retiring!.id } },
              body: { reason },
            })
            .catch((error: unknown) => {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            });
          toast.success(t("retired"));
          setRetiring(null);
          refresh();
        }}
      />
    </Section>
  );
}

function ProcessRules() {
  const t = useTranslations("styleLibrary.rules.process");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const canManage = useCan("styles.process_rules");
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<ProcessRule | null>(null);
  const [draft, setDraft] = useState({ processCode: "", scope: "category" as Scope, scopeValue: "" });
  const query = useQuery({
    queryKey: queryKeys.list("admin", "style_process_rule", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/style-process-rules")).data!,
  });
  const processes = useQuery({
    queryKey: queryKeys.list("admin", "process_type", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/process-types")).data!,
    staleTime: STALE_TIME.reference,
    enabled: creating,
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "style_process_rule") });
  const name = (ref: { nameTh: string; nameEn: string }) => (locale === "en" ? ref.nameEn : ref.nameTh);

  const columns: DataTableColumn<ProcessRule>[] = [
    {
      id: "process",
      header: t("process"),
      cell: (row) => (
        <div>
          <p className="font-medium">{name(row.process)}</p>
          <p className="text-muted font-mono text-xs">{row.process.code}</p>
        </div>
      ),
    },
    { id: "scope", header: t("scope"), cell: (row) => t(`scopes.${row.scope}`) },
    { id: "value", header: t("value"), cell: (row) => <span className="font-mono text-sm">{row.scopeValue}</span> },
    { id: "created", header: t("date"), cell: (row) => <When at={row.createdAt} /> },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t("actions"),
            cell: (row: ProcessRule) => (
              <Button size="sm" variant="ghost" onClick={() => setRemoving(row)}>
                {t("remove")}
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <Section
      title={t("title")}
      description={t("intro")}
      actions={
        canManage ? (
          <Button iconStart="plus" onClick={() => setCreating(true)}>
            {t("create")}
          </Button>
        ) : null
      }
    >
      {query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          caption={t("title")}
          columns={columns}
          rows={query.data ?? []}
          getRowId={(row) => row.id}
          loading={query.isPending}
          empty={<EmptyState icon="factory" title={t("empty")} />}
        />
      )}

      {creating ? (
        <FormDialog
          title={t("create")}
          description={t("createIntro")}
          submitLabel={t("save")}
          onClose={() => setCreating(false)}
          onSubmit={async () => {
            if (!draft.processCode || !draft.scopeValue.trim()) throw new FormError(t("incomplete"));
            await adminBrowserApis().contract.POST("/v1/admin/style-process-rules", {
              body: { processCode: draft.processCode, scope: draft.scope, scopeValue: draft.scopeValue.trim() },
            });
            toast.success(t("added"));
            refresh();
          }}
        >
          <Field label={t("process")} required>
            <Select
              value={draft.processCode || undefined}
              placeholder={t("chooseProcess")}
              onValueChange={(value) => setDraft((d) => ({ ...d, processCode: value }))}
              options={(processes.data ?? []).map((p) => ({ value: p.code, label: `${name(p)} (${p.code})` }))}
            />
          </Field>
          <Field label={t("scope")} required>
            <Select
              value={draft.scope}
              onValueChange={(value) => setDraft((d) => ({ ...d, scope: value as Scope }))}
              options={SCOPES.map((s) => ({ value: s, label: t(`scopes.${s}`) }))}
            />
          </Field>
          <Field label={t("value")} required hint={t(`valueHints.${draft.scope}`)}>
            <Input
              value={draft.scopeValue}
              className="font-mono"
              onChange={(e) => setDraft((d) => ({ ...d, scopeValue: e.target.value }))}
            />
          </Field>
        </FormDialog>
      ) : null}

      <ConfirmAction
        open={removing !== null}
        onOpenChange={(open) => (open ? undefined : setRemoving(null))}
        title={t("removeTitle")}
        description={
          removing
            ? t("removeBody", {
                process: name(removing.process),
                scope: t(`scopes.${removing.scope}`),
                value: removing.scopeValue,
              })
            : ""
        }
        confirmLabel={t("remove")}
        tone="destructive"
        onConfirm={async () => {
          await adminBrowserApis()
            .contract.DELETE("/v1/admin/style-process-rules/{ruleId}", { params: { path: { ruleId: removing!.id } } })
            .catch((error: unknown) => {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            });
          toast.success(t("removed"));
          setRemoving(null);
          refresh();
        }}
      />
    </Section>
  );
}
