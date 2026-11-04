"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import type { PointsLiabilityMemo as Memo } from "@/lib/api/requests/admin-loyalty-p2";
import { Badge } from "@/ui/components/Badge";

/**
 * The executive P&L's points memo (loyalty P2, D-480, D-495; `admin.financialReports.profitAndLoss` `pointsLiability`):
 * the liability estimated at the expected redemption rate — flagged while the CPA has not confirmed the rate — beside
 * the balance of ledger 2330, the points expense of the period (6120) and the outstanding points at face value. A memo
 * under the statement: it is not part of the lines or totals above, and the page adds nothing to it.
 */
export function PointsLiabilityMemo({ memo }: { memo: Memo }) {
  const t = useTranslations("finance.reports.profitAndLoss.points");
  const format = useFormat();
  const row = (key: string, label: React.ReactNode, amount: string, strong = false) => (
    <div key={key} className="border-border flex items-baseline justify-between gap-4 py-2.5 not-first:border-t">
      <dt className="text-sm">{label}</dt>
      <dd className={strong ? "m-0 font-semibold tabular-nums" : "m-0 tabular-nums"}>{amount}</dd>
    </div>
  );
  return (
    <section
      aria-labelledby="pl-points-memo"
      className="border-border bg-surface rounded-panel border border-dashed px-4 pt-3.5 pb-2 md:px-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="pl-points-memo" className="text-[0.9375rem] font-semibold">
          {t("title")}
        </h2>
        <p className="text-muted text-[0.8125rem]">{t("memoOnly")}</p>
      </div>
      <dl className="m-0 mt-1.5">
        {row(
          "estimate",
          <span className="flex flex-wrap items-center gap-1.5">
            {t("estimate", { rate: format.percent(memo.expectedRedemptionRatePct) })}
            {memo.rateConfirmation === "pending_cpa" ? (
              <Badge size="sm" tone="warning">
                {t("pendingCpa")}
              </Badge>
            ) : null}
          </span>,
          format.thb(memo.estimatedLiability),
          true,
        )}
        {row(
          "ledger",
          <Link
            href={`/finance/reports/roll-forwards?account=2330`}
            className="hover:text-primary underline-offset-4 hover:underline"
          >
            {t("ledger", { date: format.date(memo.asOf) })}
          </Link>,
          format.thb(memo.ledgerBalance2330),
        )}
        {row("expense", t("expense"), format.thb(memo.pointsExpenseInPeriod))}
        {row(
          "outstanding",
          t("outstanding", { points: format.number(memo.outstandingPoints) }),
          format.thb(memo.faceValue),
        )}
      </dl>
    </section>
  );
}
