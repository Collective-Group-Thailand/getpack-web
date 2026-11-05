"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  AdminCofundingContribution,
  AdminCofundingOffer,
  CapacityDealFunding,
} from "@/lib/api/requests/admin-loyalty-p4";
import type { CofundingOfferStatus } from "@/lib/api/requests/partner-loyalty-p4";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DataTable } from "@/ui/components/DataTable";
import { DateField } from "@/ui/components/DateField";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { Meter } from "@/ui/components/Meter";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, FormDialog, FormError, QueryError, Section, useCan } from "../console";
import { useP4Problem } from "./p4-problems";
import { bangkokMidnight } from "./time";

/** The capacity-deal drafts (P3), where a deal to co-fund is found. */
export const CAPACITY_DEALS_HREF = "/marketing/promotions?origin=capacity_deal";

/** Offer status → badge tone. Amber only for the one state that waits on the factory (P4 design rule). */
export const OFFER_TONE: Record<CofundingOfferStatus, "accent" | "success" | "neutral"> = {
  proposed: "accent",
  accepted: "success",
  declined: "neutral",
  withdrawn: "neutral",
  expired: "neutral",
  ended: "neutral",
};

const CONTRIBUTION_TONE = { accrued: "info", netted: "success", reversed: "neutral", refunded: "neutral" } as const;

const offersKey = (promotionId: string) => queryKeys.list("admin", "cofunding_offer", { promotionId });
const contributionsKey = (promotionId: string) => queryKeys.list("admin", "cofunding_contribution", { promotionId });

/** The money a share is as a fraction of its cap, for the meter (two API strings; the API sends both). */
export const capUse = (accrued: string, cap: string) =>
  Number(cap) > 0 ? Math.round((Number(accrued) / Number(cap)) * 100) : 0;

/** "—" or "1 โรงงาน · 40 % ของส่วนลดดีล …" for the capacity-deal list (the accepted offers only, D-506). */
export function FundingSummary({ funding }: { funding: CapacityDealFunding | null }) {
  const t = useTranslations("marketing.cofunding");
  const accepted = funding?.offers.filter((offer) => offer.status === "accepted") ?? [];
  if (accepted.length === 0) return <span className="text-muted text-sm">—</span>;
  return (
    <span className="text-sm">
      {t("summary", { count: accepted.length })}
      <span className="text-muted block text-xs">{accepted[0]!.termsText}</span>
    </span>
  );
}

/**
 * The co-funding panel of a capacity deal (loyalty P4, D-506; `/marketing/promotions/[id]`): getpack funds 100 %
 * unless a factory accepted an offer. The offers (factory, the API's terms, cap, window, status, accrued / cap meter),
 * "เสนอส่วนร่วม", withdraw with a reason, and the contributions by order. Hidden behind the flag state while
 * `capacityDeals` is off (the API answers `loyalty.feature_disabled`). Never shows free capacity, utilisation or price.
 */
export function CofundingPanel({
  promotionId,
  window,
}: {
  promotionId: string;
  /** The deal's window, the offer form's default (`YYYY-MM-DD`). */
  window: { from: string; to: string | null };
}) {
  const t = useTranslations("marketing.cofunding");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canManage = useCan("promotions.manage");
  const [proposing, setProposing] = useState(false);
  const [withdrawing, setWithdrawing] = useState<AdminCofundingOffer | null>(null);
  const offers = useQuery({
    queryKey: offersKey(promotionId),
    queryFn: async () =>
      (
        await adminBrowserApis().requests.call("GET /v1/admin/promotions/{promotionId}/cofunding-offers", {
          path: { promotionId },
          query: { perPage: 100 },
        })
      ).data,
  });
  const contributions = useQuery({
    queryKey: contributionsKey(promotionId),
    queryFn: async () =>
      (
        await adminBrowserApis().requests.call("GET /v1/admin/cofunding-contributions", {
          query: { promotionId, perPage: 100 },
        })
      ).data,
  });
  const candidates = useQuery({
    queryKey: queryKeys.list("admin", "cofunding_candidate", { promotionId }),
    enabled: canManage,
    retry: false,
    queryFn: async () =>
      (
        await adminBrowserApis().requests.call("GET /v1/admin/promotions/{promotionId}/cofunding-candidates", {
          path: { promotionId },
        })
      ).data,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "cofunding_offer") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "promotion") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "capacity_deal") });
  };

  const disabled = isApiError(candidates.error) && candidates.error.code === "loyalty.feature_disabled";
  if (disabled)
    return (
      <Section title={t("title")}>
        <p className="text-muted text-sm">{t("surfaceOff")}</p>
      </Section>
    );
  if (offers.isError) return <QueryError error={offers.error} onRetry={() => void offers.refetch()} />;

  const rows = offers.data ?? [];
  const accepted = rows.filter((offer) => offer.status === "accepted");
  const open = (candidates.data ?? []).filter((candidate) => !candidate.hasLiveOffer);

  return (
    <Section
      title={t("title")}
      description={accepted.length === 0 ? t("defaultFunder") : t("acceptedLine", { count: accepted.length })}
      actions={
        canManage && candidates.data ? (
          <Button
            size="sm"
            variant="secondary"
            iconStart="plus"
            onClick={() => setProposing(true)}
            disabled={!open.length}
          >
            {t("propose")}
          </Button>
        ) : null
      }
    >
      <DataTable<AdminCofundingOffer>
        caption={t("offersTitle")}
        rows={rows}
        loading={offers.isPending}
        getRowId={(row) => row.id}
        empty={
          <EmptyState
            icon="handshake"
            title={t("emptyOffers")}
            description={t("emptyOffersBody")}
            action={
              canManage && candidates.data && open.length ? (
                <Button variant="secondary" iconStart="plus" onClick={() => setProposing(true)}>
                  {t("propose")}
                </Button>
              ) : (
                <Button asChild variant="secondary">
                  <Link href={CAPACITY_DEALS_HREF}>{t("allDeals")}</Link>
                </Button>
              )
            }
          />
        }
        columns={[
          {
            id: "factory",
            header: t("columns.factory"),
            cell: (row) => (
              <span>
                <span className="font-medium">{row.factory.name}</span>
                <span className="text-muted block text-xs">
                  {t("window", { from: format.date(row.validFrom), to: format.date(row.validTo) })}
                </span>
              </span>
            ),
          },
          { id: "terms", header: t("columns.terms"), cell: (row) => row.termsText },
          {
            id: "status",
            header: t("columns.status"),
            cell: (row) => (
              <span>
                <Badge size="sm" tone={OFFER_TONE[row.status]}>
                  {t(`status.${row.status}`)}
                </Badge>
                {row.status === "proposed" ? (
                  <span className="text-muted block text-xs">
                    {t("respondBy", { date: format.dateTime(row.respondBy) })}
                  </span>
                ) : null}
                {row.declineReason ? <span className="text-muted block text-xs">{row.declineReason}</span> : null}
              </span>
            ),
          },
          {
            id: "use",
            header: t("columns.use"),
            cell: (row) => (
              <span className="block min-w-40">
                <span className="text-sm tabular-nums">
                  {t("use", { accrued: format.thb(row.accruedAmount), cap: format.thb(row.capAmount) })}
                </span>
                <Meter
                  className="mt-1.5 h-1.5"
                  value={capUse(row.accruedAmount, row.capAmount)}
                  label={t("columns.use")}
                  valueText={t("use", { accrued: format.thb(row.accruedAmount), cap: format.thb(row.capAmount) })}
                />
              </span>
            ),
          },
          {
            id: "actions",
            header: <span className="sr-only">{t("columns.actions")}</span>,
            cell: (row) =>
              canManage && (row.status === "proposed" || row.status === "accepted") ? (
                <Button size="sm" variant="ghost" onClick={() => setWithdrawing(row)}>
                  {t("withdraw.action")}
                </Button>
              ) : null,
          },
        ]}
      />

      <h3 className="mt-6 mb-2 text-[0.9375rem] font-semibold">{t("contributionsTitle")}</h3>
      <DataTable<AdminCofundingContribution>
        caption={t("contributionsTitle")}
        rows={contributions.data ?? []}
        loading={contributions.isPending}
        getRowId={(row) => row.id}
        empty={
          <EmptyState
            icon="receipt"
            title={t("emptyContributions")}
            action={
              <Button asChild variant="secondary">
                <Link href="/finance/payables/statements">{t("toStatements")}</Link>
              </Button>
            }
          />
        }
        columns={[
          {
            id: "order",
            header: t("columns.order"),
            cell: (row) => (
              <span className="tabular-nums">
                {row.orderCode}
                <span className="text-muted block text-xs">{row.jobNumber}</span>
              </span>
            ),
          },
          { id: "factory", header: t("columns.factory"), cell: (row) => row.factory.name },
          {
            id: "discount",
            header: t("columns.discount"),
            numeric: true,
            cell: (row) => format.thb(row.discountAmount),
          },
          {
            id: "share",
            header: t("columns.share"),
            numeric: true,
            cell: (row) => (
              <span className={row.status === "reversed" ? "text-subtle line-through" : "font-medium"}>
                {format.thb(row.shareAmount)}
              </span>
            ),
          },
          {
            id: "status",
            header: t("columns.status"),
            cell: (row) => (
              <span>
                <Badge size="sm" tone={CONTRIBUTION_TONE[row.status]}>
                  {t(`contribution.${row.status}`)}
                </Badge>
                {row.billingStatementNumber ? (
                  <span className="text-muted block text-xs tabular-nums">{row.billingStatementNumber}</span>
                ) : row.reverseReason ? (
                  <span className="text-muted block text-xs">{t(`reverseReason.${row.reverseReason}`)}</span>
                ) : null}
                {row.capped ? <span className="text-muted block text-xs">{t("capped")}</span> : null}
              </span>
            ),
          },
        ]}
      />

      {proposing ? (
        <OfferForm
          promotionId={promotionId}
          candidates={open}
          window={window}
          onClose={() => setProposing(false)}
          onDone={refresh}
        />
      ) : null}
      {withdrawing ? (
        <WithdrawDialog offer={withdrawing} onClose={() => setWithdrawing(null)} onDone={refresh} />
      ) : null}
    </Section>
  );
}

function OfferForm({
  promotionId,
  candidates,
  window,
  onClose,
  onDone,
}: {
  promotionId: string;
  candidates: { factoryId: string; name: string }[];
  window: { from: string; to: string | null };
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("marketing.cofunding.form");
  const p4Message = useP4Problem();
  const tFilters = useTranslations("console.filters");
  const format = useFormat();
  const [factoryId, setFactoryId] = useState(candidates[0]?.factoryId ?? "");
  const [mode, setMode] = useState<"pct_of_discount" | "fixed_per_order">("pct_of_discount");
  const [value, setValue] = useState("");
  const [cap, setCap] = useState("");
  const [from, setFrom] = useState(window.from);
  const [to, setTo] = useState(window.to ?? "");
  const [respondBy, setRespondBy] = useState("");
  const [note, setNote] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const money = (text: string) => {
    const number = Number(text.replace(/,/g, ""));
    return Number.isFinite(number) && number > 0 ? number.toFixed(2) : null;
  };

  return (
    <FormDialog
      title={t("title")}
      description={t("description")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        const amount = money(value);
        const capAmount = money(cap);
        if (!factoryId) throw new FormError(t("needFactory"));
        if (!amount) throw new FormError(t("needValue"));
        if (!capAmount) throw new FormError(t("needCap"));
        if (!from || !to) throw new FormError(t("needWindow"));
        try {
          await adminBrowserApis().requests.call("POST /v1/admin/promotions/{promotionId}/cofunding-offers", {
            path: { promotionId },
            idempotencyKey: key,
            body: {
              factoryId,
              mode,
              sharePct: mode === "pct_of_discount" ? amount : null,
              fixedAmount: mode === "fixed_per_order" ? amount : null,
              capAmount,
              validFrom: bangkokMidnight(from),
              validTo: bangkokMidnight(to, true),
              ...(respondBy ? { respondBy: bangkokMidnight(respondBy, true) } : {}),
              ...(note.trim() ? { note: note.trim() } : {}),
            },
          });
        } catch (error) {
          throw new FormError(p4Message(error, t("failed")));
        }
        toast.success(t("done"));
        onDone();
      }}
    >
      <Field label={t("factory")} required hint={t("factoryHint")}>
        <NativeSelect
          value={factoryId}
          onValueChange={setFactoryId}
          options={candidates.map((candidate) => ({ value: candidate.factoryId, label: candidate.name }))}
        />
      </Field>
      <SegmentedControl
        label={t("mode")}
        value={mode}
        onValueChange={(next) => setMode(next as typeof mode)}
        options={[
          { value: "pct_of_discount", label: t("modes.pct_of_discount") },
          { value: "fixed_per_order", label: t("modes.fixed_per_order") },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={mode === "pct_of_discount" ? t("sharePct") : t("fixedAmount")} required>
          <Input inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} />
        </Field>
        <Field label={t("cap")} required hint={t("capHint")}>
          <Input inputMode="decimal" value={cap} onChange={(event) => setCap(event.target.value)} />
        </Field>
        <Field label={t("from")} required>
          <DateField
            value={from}
            display={from ? format.date(from) : tFilters("pickDate")}
            onChange={(event) => setFrom(event.target.value)}
          />
        </Field>
        <Field label={t("to")} required>
          <DateField
            value={to}
            display={to ? format.date(to) : tFilters("pickDate")}
            onChange={(event) => setTo(event.target.value)}
          />
        </Field>
        <Field label={t("respondBy")} hint={t("respondByHint")}>
          <DateField
            value={respondBy}
            display={respondBy ? format.date(respondBy) : tFilters("pickDate")}
            onChange={(event) => setRespondBy(event.target.value)}
          />
        </Field>
      </div>
      <Field label={t("note")} hint={t("noteHint")}>
        <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </FormDialog>
  );
}

function WithdrawDialog({
  offer,
  onClose,
  onDone,
}: {
  offer: AdminCofundingOffer;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("marketing.cofunding.withdraw");
  const p4Message = useP4Problem();
  const [reason, setReason] = useState("");
  return (
    <FormDialog
      title={t("title", { factory: offer.factory.name })}
      description={t("body")}
      submitLabel={t("submit")}
      destructive
      onClose={onClose}
      onSubmit={async () => {
        if (reason.trim().length < 10) throw new FormError(t("needReason"));
        try {
          await adminBrowserApis().requests.call("POST /v1/admin/cofunding-offers/{offerId}/actions/withdraw", {
            path: { offerId: offer.id },
            etag: `W/"${offer.rowVersion}"`,
            body: { reason: reason.trim() },
          });
        } catch (error) {
          throw new FormError(p4Message(error, t("failed")));
        }
        toast.success(t("done"));
        onDone();
      }}
    >
      <Field label={t("reason")} required hint={t("reasonHint")}>
        <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </FormDialog>
  );
}

/**
 * The funding split in a `capacity_deal_publish` approval (D-506): getpack by default, then each offer as it stood
 * when publication was requested. An offer accepted later counts too — it can only lower getpack's cost.
 */
export function FundingSplitBlock({ funding }: { funding: CapacityDealFunding }) {
  const t = useTranslations("marketing.cofunding.approval");
  const tCofunding = useTranslations("marketing.cofunding");
  const format = useFormat();
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="font-medium">
        {funding.acceptedCount === 0
          ? t("getpackOnly")
          : t("withFactories", { count: funding.acceptedCount, share: format.thb(funding.factoryShareToDate) })}
      </p>
      {funding.offers.length ? (
        <ul className="divide-border border-border rounded-card divide-y border">
          {funding.offers.map((offer) => (
            <li key={offer.offerId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block font-medium">{offer.factoryName}</span>
                <span className="text-muted block text-xs">{offer.termsText}</span>
              </span>
              <Badge size="sm" tone={OFFER_TONE[offer.status]}>
                {tCofunding(`status.${offer.status}`)}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-muted text-xs">{t("laterCounts")}</p>
    </div>
  );
}
