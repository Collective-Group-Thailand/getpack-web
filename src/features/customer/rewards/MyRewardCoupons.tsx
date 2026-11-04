"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { CodeBox } from "@/features/shared/deals/DealCard";
import { useFormat } from "@/features/shared/format/useFormat";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { RedemptionStatus, RewardRedemption } from "@/lib/api/requests/store-loyalty-p3";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

import { COUPON_TABS, countByStatus, isCancellable, quarterOf, STUB_WORD } from "./model";
import { RewardStub } from "./RewardCard";

export interface MyRewardCouponsProps {
  redemptions: readonly RewardRedemption[];
  /** The time the page was read, so the cancel button is the same on the server and in the browser. */
  now: number;
  /** A coupon the API just changed (cancelled): the page refreshes the balance and the catalogue. */
  onChanged?: (redemption: RewardRedemption) => void;
  initialTab?: RedemptionStatus;
  className?: string;
}

/**
 * "คูปองของฉัน" (loyalty P3): the reward coupons — bought with points or granted by the tier — by status, in one
 * hairline container. Each row: the stub's word, the reward, how it was got ("แลกด้วย 60 แต้ม · date" or "สิทธิ์ระดับ
 * แพลทินัม · ไตรมาส 4/2569"), the code with its copy button, and at the end "ยกเลิกการแลก" with the date the window
 * closes — a date, never a countdown. A tier perk says it cannot be cancelled. Cancel asks once.
 */
export function MyRewardCoupons({
  redemptions,
  now,
  onChanged,
  initialTab = "issued",
  className,
}: MyRewardCouponsProps) {
  const t = useTranslations("account.rewards.mine");
  const tStub = useTranslations("account.rewards.stub");
  const format = useFormat();
  const [tab, setTab] = useState<RedemptionStatus>(initialTab);
  const [rows, setRows] = useState<readonly RewardRedemption[]>(redemptions);
  const [asking, setAsking] = useState<RewardRedemption | null>(null);
  const [busy, setBusy] = useState(false);
  // A new list from the page (after a redeem) replaces the local one.
  const [source, setSource] = useState(redemptions);
  if (source !== redemptions) {
    setSource(redemptions);
    setRows(redemptions);
  }

  const counts = countByStatus(rows);
  const shown = rows.filter((row) => row.status === tab);

  const cancel = async (row: RewardRedemption) => {
    setBusy(true);
    try {
      const updated = await browserRequests().call("POST /v1/store/rewards/redemptions/{redemptionId}/actions/cancel", {
        path: { redemptionId: row.id },
      });
      setRows((current) => current.map((candidate) => (candidate.id === updated.id ? updated : candidate)));
      toast.success(t("cancelled", { points: format.number(row.pointsSpent) }));
      onChanged?.(updated);
      setAsking(null);
    } catch (error) {
      const code = isApiError(error) ? error.code : null;
      toast.error(
        code === "rewards.cancel_window_closed"
          ? t("errors.windowClosed")
          : code === "rewards.coupon_used"
            ? t("errors.used")
            : t("errors.generic"),
      );
      setAsking(null);
    } finally {
      setBusy(false);
    }
  };

  const how = (row: RewardRedemption) => {
    if (row.source === "tier_perk") {
      const quarter = quarterOf(row.perkPeriod);
      return quarter
        ? t("perkFrom", {
            quarter: quarter.quarter,
            // The Buddhist era in Thai, as every date the customer reads (`formatDate`).
            year: String(quarter.year + (format.locale === "th" ? 543 : 0)),
          })
        : t("perk");
    }
    return t("boughtWith", { points: format.number(row.pointsSpent), date: format.date(row.createdAt) });
  };

  const statusLine = (row: RewardRedemption) => {
    switch (row.status) {
      case "issued":
        return t("validUntil", { date: format.date(row.coupon.expiresAt) });
      case "used":
        return row.usedOrderCode ? t("usedOn", { order: row.usedOrderCode }) : t("used");
      case "expired":
        return t("expiredOn", { date: format.date(row.coupon.expiresAt) });
      case "cancelled":
        return t("cancelledLine");
    }
  };

  return (
    <div className={className}>
      <SegmentedControl<RedemptionStatus>
        label={t("tabsLabel")}
        size="sm"
        value={tab}
        onValueChange={setTab}
        options={COUPON_TABS.map((status) => ({
          value: status,
          label: (
            <span className="inline-flex items-baseline gap-1.5">
              {t(`tabs.${status}`)}
              {counts[status] > 0 ? (
                <span className="text-subtle font-medium tabular-nums">{format.number(counts[status])}</span>
              ) : null}
            </span>
          ),
        }))}
      />
      {shown.length === 0 ? (
        <EmptyState className="mt-3.5" icon="ticket" title={t(`empty.${tab}`)} />
      ) : (
        <ul className="border-border bg-surface rounded-card divide-border m-0 mt-3.5 list-none divide-y border p-0">
          {shown.map((row) => {
            const spent = row.status !== "issued";
            const cancellable = isCancellable(row, now);
            return (
              <li
                key={row.id}
                className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 px-3.5 py-3.5 md:grid-cols-[4rem_minmax(0,1fr)_auto] md:px-4"
              >
                <RewardStub value={tStub(STUB_WORD[row.item.kind])} word spent={spent} />
                <div className="min-w-0">
                  <p className={cn("text-[0.9375rem] leading-snug font-semibold", spent && "text-muted")}>
                    {row.item.name}
                  </p>
                  <p className="text-muted mt-0.5 flex flex-wrap gap-x-2.5 text-[0.8125rem] tabular-nums">
                    <span className={row.source === "tier_perk" ? "text-primary-subtle-fg font-medium" : undefined}>
                      {how(row)}
                    </span>
                    <span>{statusLine(row)}</span>
                  </p>
                  {row.status === "issued" ? (
                    <CodeBox code={row.coupon.code} className="mt-2 h-[2.125rem] text-[0.8125rem]" />
                  ) : null}
                </div>
                <div className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 md:col-start-3 md:flex-col md:items-end md:text-end">
                  {cancellable ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setAsking(row)}>
                        {t("cancel")}
                      </Button>
                      <span className="text-muted text-xs tabular-nums">
                        {t("refundUntil", { date: format.dateTime(row.cancellableUntil) })}
                      </span>
                    </>
                  ) : row.status === "issued" && row.source === "tier_perk" ? (
                    <span className="text-muted text-xs">{t("perkNoCancel")}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <AlertDialog
        open={asking !== null}
        onOpenChange={(open) => (open ? null : setAsking(null))}
        title={t("confirmTitle")}
        description={
          asking ? t("confirmBody", { code: asking.coupon.code, points: format.number(asking.pointsSpent) }) : ""
        }
        confirmLabel={t("confirm")}
        cancelLabel={t("keep")}
        loading={busy}
        onConfirm={() => (asking ? void cancel(asking) : undefined)}
      />
    </div>
  );
}
