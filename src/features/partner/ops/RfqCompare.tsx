"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ERP_SUPPLIER_APPROVAL } from "@/domain/status";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { useErpCall } from "@/features/partner/erp/call";
import { formatQty } from "@/features/partner/erp/format";
import { StatusChip } from "@/features/partner/status";
import { ConfirmAction } from "@/features/shared/actions";
import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";

type Comparison = Schemas["ErpRfqComparisonDto"];

/**
 * The comparison of a request's quotations (D-348): per line every offer, cheapest per base unit first, with
 * the amount for the quantity in the supplier's unit and minimum, lead time, validity, approval (D-351) and
 * score (D-349). When it may be awarded, one offer per line is picked (the cheapest valid one to start) and
 * the picks become draft purchase orders, one per supplier.
 */
export function RfqCompare({
  rfqId,
  comparison,
  canAward,
  locale,
}: {
  rfqId: string;
  comparison: Comparison;
  canAward: boolean;
  locale: string;
}) {
  const t = useTranslations("partnerOps.rfqs");
  const tShared = useTranslations("partnerOps.shared");
  const tCommon = useTranslations("partnerErp.common");
  const format = useFormat();
  const router = useRouter();
  const { factoryId } = useFactory();
  const { call } = useErpCall();
  const [picks, setPicks] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(
      comparison.lines.map((l) => [
        l.line.id,
        l.offers.find((o) => o.awarded)?.quoteId ?? l.offers.find((o) => o.cheapest && !o.expired)?.quoteId ?? null,
      ]),
    ),
  );
  const [confirming, setConfirming] = useState(false);
  const unit = (code: string) => tCommon(`units.${code}` as never);
  const chosen = Object.entries(picks).filter((entry): entry is [string, string] => entry[1] !== null);

  return (
    <div className="flex flex-col gap-4">
      {comparison.lines.map(({ line, offers }) => (
        <section key={line.id} className="border-border bg-surface flex flex-col gap-2 rounded-xl border p-3 md:p-4">
          <h3 className="font-semibold">
            {tShared("lineTitle", {
              no: line.lineNo,
              name: line.item.name,
              qty: tCommon("inUnit", { qty: formatQty(line.quantity, locale), unit: unit(line.item.baseUnit) }),
            })}
          </h3>
          {offers.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="text-muted text-start">
                  <tr>
                    {canAward ? <th className="w-12 p-2 text-start">{t("compare.pick")}</th> : null}
                    <th className="p-2 text-start">{t("compare.supplier")}</th>
                    <th className="p-2 text-end">{t("compare.price")}</th>
                    <th className="p-2 text-end">{t("compare.base")}</th>
                    <th className="p-2 text-end">{t("compare.order")}</th>
                    <th className="p-2 text-end">{t("compare.amount")}</th>
                    <th className="p-2 text-end">{t("compare.lead")}</th>
                    <th className="p-2 text-start">{t("compare.valid")}</th>
                    <th className="p-2 text-start">{t("compare.approval")}</th>
                    <th className="p-2 text-end">{t("compare.score")}</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o) => {
                    const id = `pick-${line.id}-${o.quoteId}`;
                    return (
                      <tr
                        key={o.quoteId}
                        className={cn(
                          "border-border border-t",
                          picks[line.id] === o.quoteId && "bg-primary-subtle/50",
                          o.expired && "text-muted",
                        )}
                      >
                        {canAward ? (
                          <td className="p-2">
                            <input
                              id={id}
                              type="radio"
                              name={`pick-${line.id}`}
                              className="size-5"
                              checked={picks[line.id] === o.quoteId}
                              disabled={o.expired}
                              onChange={() => setPicks({ ...picks, [line.id]: o.quoteId })}
                              aria-label={`${t("compare.pick")} ${o.supplier.name}`}
                            />
                          </td>
                        ) : null}
                        <td className="p-2">
                          <label htmlFor={canAward ? id : undefined} className="flex flex-col">
                            <span className="font-medium">{o.supplier.name}</span>
                            <span className="flex flex-wrap gap-1">
                              {o.cheapest ? <Badge tone="success">{t("compare.cheapest")}</Badge> : null}
                              {o.fastest ? <Badge tone="info">{t("compare.fastest")}</Badge> : null}
                              {o.expired ? <Badge tone="neutral">{t("compare.expired")}</Badge> : null}
                              {o.awarded ? <Badge tone="primary">{t("compare.awarded")}</Badge> : null}
                            </span>
                          </label>
                        </td>
                        <td className="p-2 text-end tabular-nums">
                          {tShared("pricePerUnit", { price: format.thb(o.unitPrice), unit: unit(o.unit) })}
                        </td>
                        <td className="p-2 text-end tabular-nums">{format.thb(o.baseUnitPrice)}</td>
                        <td className="p-2 text-end tabular-nums">
                          {tCommon("inUnit", { qty: formatQty(o.orderQty, locale), unit: unit(o.unit) })}
                        </td>
                        <td className="p-2 text-end font-semibold tabular-nums">{format.thb(o.amount)}</td>
                        <td className="p-2 text-end">
                          {o.leadTimeDays !== null ? t("compare.leadDays", { n: o.leadTimeDays }) : "—"}
                        </td>
                        <td className="p-2">{o.validUntil ? format.date(o.validUntil) : "—"}</td>
                        <td className="p-2">
                          <StatusChip map={ERP_SUPPLIER_APPROVAL} value={o.approval} />
                        </td>
                        <td className="p-2 text-end">{o.grade ? `${o.grade} · ${Number(o.score).toFixed(0)}` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted text-sm">{t("compare.none")}</p>
          )}
          {canAward && offers.length ? (
            <Button
              size="sm"
              variant="ghost"
              className="self-start"
              onClick={() => setPicks({ ...picks, [line.id]: null })}
            >
              {tCommon("cancel")}
            </Button>
          ) : null}
        </section>
      ))}
      <p className="text-muted">{t("compare.cheapestTotal", { total: format.thb(comparison.cheapestTotal) })}</p>
      {canAward ? (
        <Button
          size="xl"
          iconStart="cart"
          className="self-start"
          disabled={!chosen.length}
          onClick={() => setConfirming(true)}
        >
          {t("award")}
        </Button>
      ) : null}
      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        title={t("awardTitle")}
        description={t("awardBody")}
        confirmLabel={t("awardConfirm")}
        onConfirm={async ({ idempotencyKey }) => {
          const result = await call(
            async () =>
              (
                await browserApi().POST("/v1/partner/factories/{factoryId}/erp/rfqs/{rfqId}/actions/award", {
                  params: { path: { factoryId, rfqId }, header: { "Idempotency-Key": idempotencyKey } },
                  body: { awards: chosen.map(([rfqLineId, quoteId]) => ({ rfqLineId, quoteId })) },
                })
              ).data,
            t("awarded"),
            { refresh: false },
          );
          setConfirming(false);
          if (result) {
            router.push(
              result.created.length === 1 ? `/purchasing/${result.created[0]!.id}` : "/purchasing?view=draft",
            );
            router.refresh();
          }
        }}
      />
    </div>
  );
}
