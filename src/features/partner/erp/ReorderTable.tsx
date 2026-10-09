"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { problemMessage } from "@/features/shared/actions";
import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { toast } from "@/ui/components/Toast";

import { formatQty } from "./format";

/**
 * What to buy now (D-326): the API's reorder list — available plus on order against the reorder point,
 * rounded up to whole purchase units — with a box per line and one action that drafts a purchase order per
 * usual supplier. Lines without a supplier can be read but not drafted.
 */
export function ReorderTable({
  rows,
  canDraft,
  locale,
}: {
  rows: Schemas["ErpReorderSuggestionDto"][];
  canDraft: boolean;
  locale: string;
}) {
  const t = useTranslations("partnerErp.stock");
  const tCommon = useTranslations("partnerErp.common");
  const format = useFormat();
  const { factoryId } = useFactory();
  const router = useRouter();
  const draftable = rows.filter((row) => row.supplier);
  const [selected, setSelected] = useState<string[]>(() => draftable.map((row) => row.item.id));
  const [busy, setBusy] = useState(false);
  const unit = (code: string) => tCommon(`units.${code}` as never);
  const qty = (value: string, code: string) => tCommon("inUnit", { qty: formatQty(value, locale), unit: unit(code) });
  const toggle = (id: string, on: boolean) =>
    setSelected((current) => (on ? [...new Set([...current, id])] : current.filter((value) => value !== id)));

  async function draft() {
    if (!selected.length) {
      toast.error(t("reorder.nothingSelected"));
      return;
    }
    setBusy(true);
    try {
      const { data } = await browserApi().POST(
        "/v1/partner/factories/{factoryId}/erp/purchase-orders/actions/from-reorder",
        { params: { path: { factoryId } }, body: { itemIds: selected } },
      );
      toast.success(t("reorder.created", { n: data?.created.length ?? 0 }));
      if (data?.skipped.length) toast.warning(t("reorder.skipped", { n: data.skipped.length }));
      router.push("/purchasing?view=draft");
    } catch (error) {
      toast.error(problemMessage(error, tCommon("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="reorder-title" className="flex flex-col gap-3">
      <div>
        <h2 id="reorder-title" className="text-lg font-semibold">
          {t("reorder.title")}
        </h2>
        <p className="text-muted max-w-prose">{t("reorder.body")}</p>
      </div>
      {canDraft && draftable.length > 1 ? (
        <Checkbox
          label={t("reorder.selectAll")}
          checked={selected.length === draftable.length ? true : selected.length ? "indeterminate" : false}
          onCheckedChange={(checked) => setSelected(checked === true ? draftable.map((row) => row.item.id) : [])}
        />
      ) : null}
      <ul className="border-border bg-surface divide-border divide-y rounded-xl border">
        {rows.map((row) => (
          <li
            key={row.item.id}
            className="grid gap-2 p-3 md:grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,1fr))] md:items-center md:p-4"
          >
            <div className="flex min-w-0 items-start gap-3">
              {canDraft ? (
                <Checkbox
                  label={<span className="sr-only">{t("reorder.select", { name: row.item.name })}</span>}
                  disabled={!row.supplier}
                  checked={selected.includes(row.item.id)}
                  onCheckedChange={(checked) => toggle(row.item.id, checked === true)}
                  className="mt-0.5"
                />
              ) : null}
              <span className="flex min-w-0 flex-col">
                <a href={`/stock/items/${row.item.id}`} className="font-medium underline-offset-4 hover:underline">
                  {row.item.name}
                </a>
                <span className="text-muted text-sm">
                  {row.supplier ? row.supplier.name : <span className="text-warning">{t("reorder.noSupplier")}</span>}
                </span>
              </span>
            </div>
            <dl className="contents">
              <div className="flex justify-between gap-2 md:block md:text-end">
                <dt className="text-muted text-sm">{t("table.available")}</dt>
                <dd className="tabular-nums">{qty(row.available, row.item.baseUnit)}</dd>
              </div>
              <div className="flex justify-between gap-2 md:block md:text-end">
                <dt className="text-muted text-sm">{t("table.toOrder")}</dt>
                <dd className="font-semibold tabular-nums">{qty(row.toOrderPurchaseQty, row.purchaseUnit)}</dd>
              </div>
              <div className="flex justify-between gap-2 md:block md:text-end">
                <dt className="text-muted text-sm">{t("table.lastPrice")}</dt>
                <dd className="tabular-nums">
                  {row.lastPurchasePrice ? format.thb(row.lastPurchasePrice) : "—"}
                  {row.needBy ? (
                    <span className="text-muted block text-sm">
                      {t("table.needBy")} {format.date(row.needBy)}
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      {canDraft ? (
        <Button size="xl" iconStart="cart" loading={busy} onClick={() => void draft()} className="self-start">
          {busy ? t("reorder.creating") : t("reorder.create")}
        </Button>
      ) : null}
    </section>
  );
}
