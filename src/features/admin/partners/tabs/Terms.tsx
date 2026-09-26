"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import { QueryError, useCan, useProductTypes } from "../../console";
import { adminBrowserApis } from "../../console/api";
import { bangkokDay, useFactoryPart, useFactoryRefresh } from "../hooks";
import { FormDialog, Section, VersionTable, type VersionRow } from "../parts";
import type { Factory } from "../resources";

type Holder<V> = { current: V | null; upcoming: V[] };
type Kind = "arrangement" | "participation" | "tolerance" | "payout";

function rows<V extends Omit<VersionRow, "summary">>(
  holder: Holder<V>,
  summary: (version: V) => React.ReactNode,
): VersionRow[] {
  return [holder.current, ...holder.upcoming]
    .filter((version): version is V => Boolean(version))
    .map((version) => ({ ...version, summary: summary(version) }));
}

const TRIGGERS: Schemas["PayoutTrigger"][] = [
  "job_accepted",
  "immediate",
  "none",
  "after_pod",
  "after_pod_and_claim_window",
];

/**
 * The factory's commercial terms, each effective-dated with a reason (D-063): who owns the price
 * list (D-042), the participation tier per product type (D-043), tolerance (D-021) and the payout
 * policy (D-022). Overrides of tolerance and payout are approved by a Superadmin (D-173), so a new
 * version of either waits as "awaiting approval" with its approval linked.
 */
export function Terms({ factory }: { factory: Factory }) {
  const t = useTranslations("partners.terms");
  const format = useFormat();
  const canManage = useCan("partners.manage");
  const refresh = useFactoryRefresh(factory.id);
  const productTypes = useProductTypes();
  const config = useFactoryPart(factory.id, "/v1/admin/factories/{factoryId}/configuration");
  const [open, setOpen] = useState<{ kind: Kind; productTypeId?: string | null } | null>(null);
  const [common, setCommon] = useState({ effectiveFrom: "", reason: "" });
  const [values, setValues] = useState<Record<string, string>>({});

  if (config.isError) return <QueryError error={config.error} onRetry={() => void config.refetch()} />;
  const data = config.data;
  if (!data) return null;

  const typeName = (id: string | null, code: string | null) =>
    id === null ? t("allTypes") : (productTypes.options.find((option) => option.value === code)?.label ?? code ?? id);
  const start = (kind: Kind, preset: Record<string, string>, productTypeId?: string | null) => {
    setCommon({ effectiveFrom: "", reason: "" });
    setValues(preset);
    setOpen({ kind, productTypeId });
  };
  const newButton = (kind: Kind, preset: Record<string, string>, productTypeId?: string | null, label?: string) =>
    canManage ? (
      <Button size="sm" variant="secondary" onClick={() => start(kind, preset, productTypeId)}>
        {label ?? t("newVersion")}
      </Button>
    ) : null;

  const submit = async () => {
    const api = adminBrowserApis().contract;
    const path = { params: { path: { factoryId: factory.id } } };
    const base = {
      reason: common.reason,
      ...(common.effectiveFrom ? { effectiveFrom: bangkokDay(common.effectiveFrom) } : {}),
    };
    let result: Schemas["VersionWriteResultDto"] | undefined;
    switch (open!.kind) {
      case "arrangement":
        result = (
          await api.POST("/v1/admin/factories/{factoryId}/pricing-arrangement-versions", {
            ...path,
            body: { ...base, ownershipMode: values.ownershipMode as Schemas["PriceOwnershipMode"] },
          })
        ).data;
        break;
      case "participation":
        result = (
          await api.POST("/v1/admin/factories/{factoryId}/participations", {
            ...path,
            body: {
              ...base,
              productTypeId: open!.productTypeId!,
              tier: values.tier as Schemas["ParticipationTier"],
              envelopeNote: values.envelopeNote?.trim() || null,
            },
          })
        ).data;
        break;
      case "tolerance":
        result = (
          await api.POST("/v1/admin/factories/{factoryId}/tolerance-versions", {
            ...path,
            body: {
              ...base,
              productTypeId: open!.productTypeId ?? null,
              shortagePct: Number(values.shortagePct),
              overagePct: Number(values.overagePct),
            },
          })
        ).data;
        break;
      case "payout":
        result = (
          await api.POST("/v1/admin/factories/{factoryId}/payout-policy-versions", {
            ...path,
            body: {
              ...base,
              advancePct: Number(values.advancePct),
              advanceTrigger: values.advanceTrigger as Schemas["PayoutTrigger"],
              balanceTrigger: values.balanceTrigger as Schemas["PayoutTrigger"],
              claimWindowDays: Number(values.claimWindowDays),
              paymentTermsDays: Number(values.paymentTermsDays),
              retentionPct: Number(values.retentionPct),
              retentionReleaseDays: Number(values.retentionReleaseDays),
            },
          })
        ).data;
        break;
    }
    toast.success(result?.status === "proposed" ? t("sentForApproval") : t("saved"));
    refresh();
  };

  const arrangement = data.pricingArrangement;
  const payout = data.payoutPolicy;
  const payoutPreset = (version: Schemas["PayoutPolicyVersionDto"] | null) => ({
    advancePct: version?.advancePct ?? "0",
    advanceTrigger: version?.advanceTrigger ?? "job_accepted",
    balanceTrigger: version?.balanceTrigger ?? "after_pod_and_claim_window",
    claimWindowDays: String(version?.claimWindowDays ?? 7),
    paymentTermsDays: String(version?.paymentTermsDays ?? 30),
    retentionPct: version?.retentionPct ?? "0",
    retentionReleaseDays: String(version?.retentionReleaseDays ?? 0),
  });

  return (
    <div className="flex flex-col gap-4">
      <Section
        title={t("arrangement")}
        description={t("arrangementNote")}
        actions={newButton("arrangement", {
          ownershipMode: arrangement.current?.ownershipMode ?? "factory_price_list",
        })}
      >
        <VersionTable
          caption={t("arrangement")}
          rows={rows(arrangement, (version) => (
            <Badge>{t(`modes.${version.ownershipMode}`)}</Badge>
          ))}
        />
      </Section>

      <Section title={t("participations")} description={t("participationsNote")}>
        <div className="flex flex-col gap-4">
          {data.participations.map((item) => (
            <div key={item.productTypeId}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{typeName(item.productTypeId, item.productTypeCode)}</p>
                {newButton(
                  "participation",
                  { tier: item.current?.tier ?? "C", envelopeNote: item.current?.envelopeNote ?? "" },
                  item.productTypeId,
                  t("changeTier"),
                )}
              </div>
              <VersionTable
                caption={typeName(item.productTypeId, item.productTypeCode)}
                rows={rows(item, (version) => (
                  <span className="flex flex-wrap items-center gap-1">
                    <Badge tone="primary">{t("tier", { tier: version.tier })}</Badge>
                    <span className="text-muted text-xs">
                      {version.envelopeNote ?? t(`tierMeaning.${version.tier}`)}
                    </span>
                  </span>
                ))}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("tolerance")} description={t("toleranceNote")}>
        <div className="flex flex-col gap-4">
          {data.tolerances.map((item) => (
            <div key={item.productTypeId ?? "default"}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{typeName(item.productTypeId, item.productTypeCode)}</p>
                {newButton(
                  "tolerance",
                  { shortagePct: item.current?.shortagePct ?? "5", overagePct: item.current?.overagePct ?? "5" },
                  item.productTypeId,
                )}
              </div>
              <VersionTable
                caption={t("tolerance")}
                rows={rows(item, (version) =>
                  t("toleranceValue", {
                    shortage: format.percent(version.shortagePct),
                    overage: format.percent(version.overagePct),
                  }),
                )}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title={t("payout")}
        description={t("payoutNote")}
        actions={newButton("payout", payoutPreset(payout.current))}
      >
        <VersionTable
          caption={t("payout")}
          rows={rows(payout, (version) => (
            <span className="text-sm">
              {t("payoutValue", {
                advance: format.percent(version.advancePct),
                advanceTrigger: t(`triggers.${version.advanceTrigger}`),
                balanceTrigger: t(`triggers.${version.balanceTrigger}`),
                terms: version.paymentTermsDays,
                claim: version.claimWindowDays,
              })}
            </span>
          ))}
        />
      </Section>

      {open ? (
        <FormDialog
          title={t(`titles.${open.kind}`)}
          description={t("dialogBody", { code: factory.code })}
          submitLabel={open.kind === "tolerance" || open.kind === "payout" ? t("sendForApproval") : t("save")}
          onClose={() => setOpen(null)}
          onSubmit={submit}
        >
          {open.kind === "tolerance" || open.kind === "payout" ? (
            <Callout tone="info" title={t("needsApproval")} />
          ) : null}
          {open.kind === "arrangement" ? (
            <Field label={t("ownershipMode")}>
              <Select
                value={values.ownershipMode}
                onValueChange={(ownershipMode) => setValues({ ...values, ownershipMode })}
                options={(["factory_price_list", "platform_rate_card"] as const).map((value) => ({
                  value,
                  label: t(`modes.${value}`),
                }))}
              />
            </Field>
          ) : null}
          {open.kind === "participation" ? (
            <>
              <Field label={t("tierLabel")} hint={t(`tierMeaning.${values.tier ?? "C"}`)}>
                <Select
                  value={values.tier}
                  onValueChange={(tier) => setValues({ ...values, tier })}
                  options={(["A", "B", "C"] as const).map((value) => ({ value, label: t("tier", { tier: value }) }))}
                />
              </Field>
              <Field label={t("envelope")} hint={t("envelopeHint")}>
                <Input
                  value={values.envelopeNote ?? ""}
                  onChange={(event) => setValues({ ...values, envelopeNote: event.target.value })}
                />
              </Field>
            </>
          ) : null}
          {open.kind === "tolerance" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("shortage")}>
                <NumberInput
                  unit="%"
                  step="0.1"
                  value={values.shortagePct}
                  onChange={(event) => setValues({ ...values, shortagePct: event.target.value })}
                />
              </Field>
              <Field label={t("overage")}>
                <NumberInput
                  unit="%"
                  step="0.1"
                  value={values.overagePct}
                  onChange={(event) => setValues({ ...values, overagePct: event.target.value })}
                />
              </Field>
            </div>
          ) : null}
          {open.kind === "payout" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("advancePct")}>
                <NumberInput
                  unit="%"
                  value={values.advancePct}
                  onChange={(event) => setValues({ ...values, advancePct: event.target.value })}
                />
              </Field>
              <Field label={t("advanceTrigger")}>
                <Select
                  value={values.advanceTrigger}
                  onValueChange={(advanceTrigger) => setValues({ ...values, advanceTrigger })}
                  options={TRIGGERS.map((value) => ({ value, label: t(`triggers.${value}`) }))}
                />
              </Field>
              <Field label={t("balanceTrigger")}>
                <Select
                  value={values.balanceTrigger}
                  onValueChange={(balanceTrigger) => setValues({ ...values, balanceTrigger })}
                  options={TRIGGERS.map((value) => ({ value, label: t(`triggers.${value}`) }))}
                />
              </Field>
              <Field label={t("paymentTerms")}>
                <NumberInput
                  unit={t("days")}
                  value={values.paymentTermsDays}
                  onChange={(event) => setValues({ ...values, paymentTermsDays: event.target.value })}
                />
              </Field>
              <Field label={t("claimWindow")}>
                <NumberInput
                  unit={t("days")}
                  value={values.claimWindowDays}
                  onChange={(event) => setValues({ ...values, claimWindowDays: event.target.value })}
                />
              </Field>
              <Field label={t("retentionPct")}>
                <NumberInput
                  unit="%"
                  value={values.retentionPct}
                  onChange={(event) => setValues({ ...values, retentionPct: event.target.value })}
                />
              </Field>
              <Field label={t("retentionDays")}>
                <NumberInput
                  unit={t("days")}
                  value={values.retentionReleaseDays}
                  onChange={(event) => setValues({ ...values, retentionReleaseDays: event.target.value })}
                />
              </Field>
            </div>
          ) : null}
          <Field label={t("effectiveFrom")} hint={t("effectiveHint")}>
            <Input
              type="date"
              value={common.effectiveFrom}
              onChange={(event) => setCommon({ ...common, effectiveFrom: event.target.value })}
            />
          </Field>
          <Field label={t("reason")} required>
            <Textarea
              rows={2}
              value={common.reason}
              onChange={(event) => setCommon({ ...common, reason: event.target.value })}
            />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}
