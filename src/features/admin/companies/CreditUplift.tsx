"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { creditUpliftOf, creditVersionP3Of } from "@/features/shared/loyalty-p3/read";
import { useFormat } from "@/features/shared/format";
import type { CreditUplift, CreditUpliftMode } from "@/lib/api/requests/admin-loyalty-p3";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage, Section } from "../console";

const MODES: readonly CreditUpliftMode[] = ["auto", "frozen", "off"];

export interface CreditUpliftPanelProps {
  companyId: string;
  /** `admin.companyCredit.get` as the API answered it (P3 fields read here). */
  credit: Schemas["AdminCompanyCreditDto"];
  canManage: boolean;
  /** Opens the credit-limit request prefilled with the full target (D-501, through `credit_limit`). */
  onRequestFull: (amount: string) => void;
  /** After a mode change: the credit is read again. */
  onChanged: (uplift: CreditUplift) => void;
  /** Arrived from `/finance/credit-uplifts` to file the full amount: that button leads. */
  requestLeads?: boolean;
}

/**
 * The tier uplift of a company's credit limit (loyalty P3, D-485 / D-501), in the company's credit tab: the tier of
 * the company's own 12-month spend, the approved base, the target (base × the tier factor) and, when the target is
 * above the automatic cap, what was given and what is left to request. Finance sets the mode — อัตโนมัติ (the
 * nightly job manages it), หยุดไว้ (the limit in force stays), ปิด (back to the base now) — with a reason, audited.
 * Every figure is the API's; nothing here multiplies or caps.
 */
export function CreditUpliftPanel({
  companyId,
  credit,
  canManage,
  onRequestFull,
  onChanged,
  requestLeads = false,
}: CreditUpliftPanelProps) {
  const t = useTranslations("companies.credit.uplift");
  const format = useFormat();
  const uplift = creditUpliftOf(credit);
  const [asking, setAsking] = useState<CreditUpliftMode | null>(null);
  const [reason, setReason] = useState("");
  const [refused, setRefused] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!uplift) return null;

  const setMode = async () => {
    if (!asking) return;
    if (reason.trim().length < 10) {
      setRefused(t("reasonShort"));
      return;
    }
    setBusy(true);
    try {
      const answer = await adminBrowserApis().requests.call("PUT /v1/admin/companies/{companyId}/credit/uplift", {
        path: { companyId },
        body: { mode: asking, reason: reason.trim() },
      });
      toast.success(t(`modeSet.${asking}`));
      setAsking(null);
      onChanged(answer.uplift);
    } catch (error) {
      setRefused(problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  };

  const fact = (key: string, label: string, value: React.ReactNode, hint?: React.ReactNode) => (
    <div key={key} className="rounded-md border p-3">
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      {hint ? <dd className="text-muted mt-0.5 text-xs">{hint}</dd> : null}
    </div>
  );

  return (
    <Section
      title={t("title")}
      description={t("note")}
      actions={
        canManage && uplift.baseLimit ? (
          <SegmentedControl<CreditUpliftMode>
            label={t("modeLabel")}
            size="sm"
            value={uplift.mode}
            onValueChange={(mode) => {
              if (mode === uplift.mode) return;
              setReason("");
              setRefused(null);
              setAsking(mode);
            }}
            options={MODES.map((mode) => ({ value: mode, label: t(`modes.${mode}`) }))}
          />
        ) : (
          <Badge tone="neutral">{t(`modes.${uplift.mode}`)}</Badge>
        )
      }
    >
      {uplift.baseLimit ? (
        <dl className="grid gap-3 sm:grid-cols-4">
          {fact(
            "tier",
            t("companyTier"),
            uplift.companyTier ? t(`tiers.${uplift.companyTier}`) : "–",
            t("spend", { amount: format.thb(uplift.companySpend12m) }),
          )}
          {fact("base", t("base"), format.thb(uplift.baseLimit))}
          {fact(
            "target",
            t("target"),
            uplift.target ? format.thb(uplift.target) : "–",
            uplift.capped ? (
              <Badge size="sm" tone="warning">
                {t("capped")}
              </Badge>
            ) : null,
          )}
          {fact(
            "inForce",
            t("inForce"),
            credit.limitAmount ? format.thb(credit.limitAmount) : "–",
            uplift.modeReason ? t("modeReason", { reason: uplift.modeReason }) : null,
          )}
        </dl>
      ) : (
        <p className="text-muted text-sm">{t("notEligible")}</p>
      )}
      {uplift.aboveCapTarget && canManage ? (
        <div className="border-border mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed p-3">
          <p className="text-sm">
            {t("aboveCap", { target: format.thb(uplift.aboveCapTarget) })}
            <span className="text-muted block text-xs">{t("aboveCapNote")}</span>
          </p>
          <Button
            size="sm"
            variant={requestLeads ? "primary" : "secondary"}
            disabled={credit.pendingRequest !== null}
            onClick={() => onRequestFull(uplift.aboveCapTarget!)}
          >
            {t("requestFull")}
          </Button>
        </div>
      ) : null}
      <Dialog
        open={asking !== null}
        onOpenChange={(open) => (open ? null : setAsking(null))}
        title={asking ? t(`confirm.${asking}.title`) : ""}
        description={asking ? t(`confirm.${asking}.body`, { base: format.thb(uplift.baseLimit) }) : undefined}
        closeLabel={t("close")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsking(null)}>
              {t("keep")}
            </Button>
            <Button loading={busy} onClick={() => void setMode()}>
              {asking ? t(`confirm.${asking}.action`) : ""}
            </Button>
          </>
        }
      >
        <Field label={t("reason")} hint={t("reasonHint")} error={refused ?? undefined} required>
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </Dialog>
    </Section>
  );
}

/** The origin of a credit-limit version as a badge: nothing for a request, the factor for an uplift. */
export function CreditOriginBadge({ version }: { version: object }) {
  const t = useTranslations("companies.credit.uplift");
  const origin = creditVersionP3Of(version);
  if (origin.origin === "request") return null;
  return (
    <Badge size="sm" tone={origin.origin === "tier_uplift" ? "primary" : "neutral"}>
      {origin.origin === "tier_uplift"
        ? t("origins.tier_uplift", {
            tier: origin.companyTier ? t(`tiers.${origin.companyTier}`) : "",
            factor: origin.upliftFactor ?? "",
          })
        : t("origins.tier_uplift_override")}
    </Badge>
  );
}
