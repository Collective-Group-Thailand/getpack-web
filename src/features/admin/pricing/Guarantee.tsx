"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { SETTING_VERSION_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  effectiveInstant,
  FormDialog,
  FormError,
  problemMessage,
  QueryError,
  Section,
  StatusChip,
  today,
  useCan,
} from "../console";
import { useRefreshPricing } from "./lookups";

type Version = Schemas["GuaranteeVersionDto"];
type Rule = Schemas["GuaranteeRuleDto"];
type ClaimType = Schemas["ClaimType"];
type Severity = Schemas["ClaimSeverity"];
type Remedy = Schemas["GuaranteeMatrixRemedy"];

const CLAIM_TYPES = [
  "damaged",
  "wrong_spec",
  "print_defect",
  "quantity_short",
  "late",
  "other",
] as const satisfies readonly ClaimType[];
const SEVERITIES = ["minor", "major", "critical"] as const satisfies readonly Severity[];
const REMEDIES = ["reprint", "refund", "partial_credit"] as const satisfies readonly Remedy[];

const cellKey = (type: ClaimType, severity: Severity) => `${type}:${severity}`;

/** The remedy matrix as claim type × severity → remedies. */
function Matrix({
  rules,
  onChange,
  caption,
}: {
  rules: readonly Rule[];
  onChange?: (rules: Rule[]) => void;
  caption: string;
}) {
  const t = useTranslations("pricing.guarantee");
  const remediesOf = (type: ClaimType, severity: Severity) =>
    rules.find((rule) => rule.claimType === type && rule.severity === severity)?.remedies ?? [];
  const toggle = (type: ClaimType, severity: Severity, remedy: Remedy, on: boolean) => {
    const current = remediesOf(type, severity);
    const remedies = on ? [...current, remedy] : current.filter((value) => value !== remedy);
    const others = rules.filter((rule) => !(rule.claimType === type && rule.severity === severity));
    onChange?.([...others, { claimType: type, severity, remedies }]);
  };
  return (
    <div className="border-border overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-subtle text-muted text-xs">
          <tr>
            <th className="px-3 py-2 text-start font-medium">{t("claimType")}</th>
            {SEVERITIES.map((severity) => (
              <th key={severity} className="px-3 py-2 text-start font-medium">
                {t(`severities.${severity}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CLAIM_TYPES.map((type) => (
            <tr key={type} className="border-border border-t align-top">
              <th scope="row" className="px-3 py-2 text-start font-medium">
                {t(`claimTypes.${type}`)}
              </th>
              {SEVERITIES.map((severity) => {
                const remedies = remediesOf(type, severity);
                return (
                  <td key={severity} className="px-3 py-2">
                    {onChange ? (
                      <div className="flex flex-col gap-1">
                        {REMEDIES.map((remedy) => (
                          <Checkbox
                            key={remedy}
                            size="sm"
                            label={t(`remedies.${remedy}`)}
                            aria-label={t("cellLabel", {
                              type: t(`claimTypes.${type}`),
                              severity: t(`severities.${severity}`),
                              remedy: t(`remedies.${remedy}`),
                            })}
                            id={`${cellKey(type, severity)}:${remedy}`}
                            checked={remedies.includes(remedy)}
                            onCheckedChange={(on) => toggle(type, severity, remedy, on === true)}
                          />
                        ))}
                      </div>
                    ) : remedies.length ? (
                      remedies.map((remedy) => t(`remedies.${remedy}`)).join(", ")
                    ) : (
                      <span className="text-muted">{t("noRemedy")}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The guarantee policy (D-198 – D-200, D-260): how fast Packio answers and decides a claim, and the
 * remedies by claim type and severity. The CS Lead proposes a version; it goes to C-Level as an
 * approval and applies from its date once approved, never backwards. One proposal at a time.
 */
export function GuaranteePolicy() {
  const t = useTranslations("pricing.guarantee");
  const format = useFormat();
  const refresh = useRefreshPricing();
  const canManage = useCan("guarantee_policies.manage");
  const [proposing, setProposing] = useState(false);
  const [withdrawing, setWithdrawing] = useState<Version | null>(null);
  const [shownNo, setShownNo] = useState<number | null>(null);
  // "In force" is judged at the moment the page opened, not re-read on every render.
  const [now] = useState(() => Date.now());
  const versions = useQuery({
    queryKey: queryKeys.list("admin", "guarantee_policy"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/guarantee-policies")).data!,
  });
  if (versions.isError) return <QueryError error={versions.error} onRetry={() => void versions.refetch()} />;
  if (!versions.data) return <Skeleton className="h-64" />;

  const list = versions.data;
  const inForce =
    list.find((version) => version.status === "approved" && new Date(version.effectiveFrom).getTime() <= now) ?? null;
  const pending =
    list.find((version) => version.status === "proposed" || version.status === "pending_acceptance") ?? null;
  const shown = list.find((version) => version.versionNo === shownNo) ?? inForce ?? list[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-sm">{t("body")}</p>
      {pending ? (
        <Callout tone="warning" title={t("pendingTitle", { no: pending.versionNo })}>
          <div className="flex flex-wrap items-center gap-3">
            <span>{t("pendingBody", { date: format.dateTime(pending.effectiveFrom) })}</span>
            {pending.approvalRequestId ? (
              <Link href={`/approvals/${pending.approvalRequestId}`} className="text-primary underline">
                {t("openApproval")}
              </Link>
            ) : null}
            {canManage ? (
              <Button size="sm" variant="ghost" onClick={() => setWithdrawing(pending)}>
                {t("withdraw")}
              </Button>
            ) : null}
          </div>
        </Callout>
      ) : null}
      {shown ? (
        <Section
          title={
            <>
              {t("versionTitle", { no: shown.versionNo })}
              <StatusChip map={SETTING_VERSION_STATUS} value={shown.status} />
              {shown.id === inForce?.id ? (
                <Badge size="sm" tone="success">
                  {t("inForce")}
                </Badge>
              ) : null}
            </>
          }
          actions={
            canManage ? (
              <Button
                iconStart="edit"
                disabled={Boolean(pending)}
                title={pending ? t("oneAtATime") : undefined}
                onClick={() => setProposing(true)}
              >
                {t("propose")}
              </Button>
            ) : null
          }
        >
          <DescriptionList
            columns={2}
            items={[
              { term: t("responseDays"), description: t("businessDays", { days: shown.responseBusinessDays }) },
              { term: t("decisionDays"), description: t("businessDays", { days: shown.decisionBusinessDays }) },
              { term: t("claimWindow"), description: t("days", { days: shown.claimWindowDays }) },
              { term: t("effectiveFrom"), description: format.dateTime(shown.effectiveFrom) },
              { term: t("reason"), description: shown.reason },
            ]}
          />
          <div className="mt-4">
            <Matrix rules={shown.rules} caption={t("matrix")} />
          </div>
        </Section>
      ) : (
        <EmptyState
          icon="shield"
          title={t("empty")}
          action={
            canManage ? (
              <Button iconStart="plus" onClick={() => setProposing(true)}>
                {t("propose")}
              </Button>
            ) : undefined
          }
        />
      )}

      {list.length > 1 ? (
        <Section title={t("history")}>
          <SegmentedControl
            label={t("history")}
            value={String(shown?.versionNo ?? "")}
            onValueChange={(value) => setShownNo(Number(value))}
            options={list.map((version) => ({
              value: String(version.versionNo),
              label: t("versionShort", { no: version.versionNo }),
            }))}
          />
        </Section>
      ) : null}

      {proposing ? (
        <ProposeDialog
          from={inForce ?? list[0] ?? null}
          onClose={() => setProposing(false)}
          onDone={() => {
            setProposing(false);
            setShownNo(null);
            void versions.refetch();
            refresh();
          }}
        />
      ) : null}
      <ConfirmAction
        open={Boolean(withdrawing)}
        onOpenChange={(open) => (open ? undefined : setWithdrawing(null))}
        title={t("withdrawTitle", { no: withdrawing?.versionNo ?? 0 })}
        description={t("withdrawBody")}
        confirmLabel={t("withdraw")}
        tone="destructive"
        reason={{ label: t("withdrawReason"), required: true, minLength: 3 }}
        onConfirm={async ({ reason }) => {
          try {
            await adminBrowserApis().contract.POST("/v1/admin/guarantee-policies/{versionId}/actions/withdraw", {
              params: { path: { versionId: withdrawing!.id } },
              body: { reason },
            });
            toast.success(t("withdrawn"));
            void versions.refetch();
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </div>
  );
}

function ProposeDialog({ from, onClose, onDone }: { from: Version | null; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("pricing.guarantee");
  const [rules, setRules] = useState<Rule[]>(
    () => from?.rules.map((rule) => ({ ...rule, remedies: [...rule.remedies] })) ?? [],
  );
  const [response, setResponse] = useState(String(from?.responseBusinessDays ?? 1));
  const [decision, setDecision] = useState(String(from?.decisionBusinessDays ?? 5));
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [reason, setReason] = useState("");
  return (
    <FormDialog
      size="xl"
      title={t("proposeTitle")}
      description={t("proposeBody")}
      submitLabel={t("proposeSubmit")}
      onClose={onClose}
      onSubmit={async () => {
        if (!/^\d{1,2}$/.test(response) || Number(response) < 1) throw new FormError(t("errors.response"));
        if (!/^\d{1,2}$/.test(decision) || Number(decision) < 1) throw new FormError(t("errors.decision"));
        if (effectiveFrom < today()) throw new FormError(t("errors.backDated"));
        if (reason.trim().length < 3) throw new FormError(t("errors.reason"));
        // Every cell is sent: an empty one states "no remedy" rather than leaving it unsaid.
        const matrix = CLAIM_TYPES.flatMap((claimType) =>
          SEVERITIES.map((severity) => ({
            claimType,
            severity,
            remedies: rules.find((rule) => rule.claimType === claimType && rule.severity === severity)?.remedies ?? [],
          })),
        );
        await adminBrowserApis().contract.POST("/v1/admin/guarantee-policies", {
          body: {
            responseBusinessDays: Number(response),
            decisionBusinessDays: Number(decision),
            effectiveFrom: effectiveInstant(effectiveFrom),
            reason: reason.trim(),
            rules: matrix,
          },
        });
        toast.success(t("proposed"));
        onDone();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("responseDays")} required>
          <NumberInput
            min={1}
            max={30}
            unit={t("daysUnit")}
            value={response}
            onChange={(event) => setResponse(event.target.value)}
          />
        </Field>
        <Field label={t("decisionDays")} required>
          <NumberInput
            min={1}
            max={60}
            unit={t("daysUnit")}
            value={decision}
            onChange={(event) => setDecision(event.target.value)}
          />
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
      <Matrix rules={rules} onChange={setRules} caption={t("matrix")} />
      <p className="text-muted text-xs">{t("matrixHint")}</p>
      <Field label={t("reason")} required>
        <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </FormDialog>
  );
}
