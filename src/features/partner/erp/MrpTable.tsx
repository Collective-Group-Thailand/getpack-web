"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { EmptyState } from "@/ui/components/EmptyState";

import { useErpCall } from "./call";
import { formatQty } from "./format";

/**
 * What production is short of (D-342): per material, what open orders still need against what is held for
 * them, free and coming; the shortage in the supplier's unit. The ticked rows become one purchase request.
 */
export function MrpTable({
  rows,
  canRequest,
  locale,
}: {
  rows: Schemas["ErpMrpRowDto"][];
  canRequest: boolean;
  locale: string;
}) {
  const t = useTranslations("partnerFactory.planning.mrp");
  const tCommon = useTranslations("partnerErp.common");
  const format = useFormat();
  const { factoryId } = useFactory();
  const router = useRouter();
  const { call, busy } = useErpCall();
  const [selected, setSelected] = useState<string[]>(() => rows.map((row) => row.item.id));
  const [key] = useState(() => newIdempotencyKey());
  const unit = (code: string) => tCommon(`units.${code}` as never);
  const qty = (value: string, code: string) => tCommon("inUnit", { qty: formatQty(value, locale), unit: unit(code) });

  if (!rows.length) return <EmptyState icon="check" title={t("none")} description={t("noneBody")} />;

  async function request() {
    const pr = await call(
      async () =>
        (
          await browserApi().POST("/v1/partner/factories/{factoryId}/erp/planning/mrp/actions/request", {
            params: { path: { factoryId }, header: { "Idempotency-Key": key } },
            body: { itemIds: selected },
          })
        ).data,
      t("requested"),
      { refresh: false },
    );
    if (pr) router.push(`/purchasing/requests/${pr.id}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="border-border bg-surface divide-border divide-y rounded-xl border">
        {rows.map((row) => (
          <li
            key={row.item.id}
            className="grid gap-2 p-3 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] md:items-center md:p-4"
          >
            <div className="flex min-w-0 items-start gap-3">
              {canRequest ? (
                <Checkbox
                  label={<span className="sr-only">{t("select", { name: row.item.name })}</span>}
                  checked={selected.includes(row.item.id)}
                  onCheckedChange={(checked) =>
                    setSelected((current) =>
                      checked === true
                        ? [...new Set([...current, row.item.id])]
                        : current.filter((id) => id !== row.item.id),
                    )
                  }
                  className="mt-0.5"
                />
              ) : null}
              <span className="flex min-w-0 flex-col">
                <Link href={`/stock/items/${row.item.id}`} className="font-medium underline-offset-4 hover:underline">
                  {row.item.name}
                </Link>
                <span className="text-muted text-sm">
                  {row.supplier ? row.supplier.name : <span className="text-warning">{t("noSupplier")}</span>}
                  {row.neededBy ? ` · ${t("neededBy", { date: format.date(row.neededBy) })}` : ""}
                </span>
              </span>
            </div>
            <dl className="contents">
              <div className="flex justify-between gap-2 md:block md:text-end">
                <dt className="text-muted text-sm">{t("required")}</dt>
                <dd className="tabular-nums">{qty(row.required, row.item.baseUnit)}</dd>
              </div>
              <div className="flex justify-between gap-2 md:block md:text-end">
                <dt className="text-muted text-sm">{t("covered")}</dt>
                <dd className="tabular-nums">
                  {t("coveredValue", {
                    reserved: formatQty(row.reserved, locale),
                    free: formatQty(row.available, locale),
                    coming: formatQty(row.onOrder, locale),
                  })}
                </dd>
              </div>
              <div className="flex justify-between gap-2 md:block md:text-end">
                <dt className="text-muted text-sm">{t("shortage")}</dt>
                <dd className="text-danger font-semibold tabular-nums">{qty(row.shortage, row.item.baseUnit)}</dd>
              </div>
              <div className="flex justify-between gap-2 md:block md:text-end">
                <dt className="text-muted text-sm">{t("toOrder")}</dt>
                <dd className="font-semibold tabular-nums">
                  {qty(row.toOrderPurchaseQty, row.purchaseUnit)}
                  {row.unitPrice ? (
                    <span className="text-muted block text-sm font-normal">
                      {t("atPrice", { price: format.thb(row.unitPrice), unit: unit(row.purchaseUnit) })}
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      {canRequest ? (
        <Button
          size="xl"
          iconStart="checklist"
          loading={busy}
          disabled={!selected.length}
          onClick={() => void request()}
          className="self-start"
        >
          {t("request")}
        </Button>
      ) : null}
    </div>
  );
}
