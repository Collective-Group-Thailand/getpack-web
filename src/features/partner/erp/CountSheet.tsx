"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { FormColumns, FormSummary } from "@/features/partner/form-layout";
import { Select } from "@/features/partner/select";
import { problemMessage } from "@/features/shared/actions";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

import { formatQty, plainNumber, QTY_PATTERN } from "./format";
import type { PickItem } from "./LinesEditor";

type Warehouse = Pick<Schemas["ErpWarehouseDto"], "id" | "code" | "name" | "isDefault">;
type Balance = Schemas["ErpStockBalanceDto"];

/** Difference in thousandths, without floats (counted − system). */
const milli = (v: string) => {
  const [w, f = ""] = plainNumber(v).replace(/^-/, "").split(".");
  const n = BigInt(w || "0") * 1000n + BigInt((f + "000").slice(0, 3));
  return v.trim().startsWith("-") ? -n : n;
};
const fromMilli = (n: bigint) => {
  const sign = n < 0n ? "-" : n > 0n ? "+" : "";
  const a = n < 0n ? -n : n;
  const frac = String(a % 1000n)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return `${sign}${a / 1000n}${frac ? `.${frac}` : ""}`;
};

/**
 * A warehouse's count sheet (D-324): every item the warehouse holds, with what the system says (hidden for a blind
 * count), the count typed beside it and the difference live. Only the lines counted are posted, as one `count`
 * adjustment with its reason; items kept by lot are counted lot by lot on the single-item form. Printable for the
 * walk round the store.
 */
export function CountSheet({
  items,
  warehouses,
  locale,
}: {
  items: PickItem[];
  warehouses: Warehouse[];
  locale: string;
}) {
  const t = useTranslations("partnerErp.count");
  const tCommon = useTranslations("partnerErp.common");
  const tSections = useTranslations("partnerErp.common.sections");
  const tMove = useTranslations("partnerErp.move");
  const { factoryId } = useFactory();
  const router = useRouter();
  const main = warehouses.find((w) => w.isDefault) ?? warehouses[0];
  const [warehouseId, setWarehouseId] = useState(main?.id ?? "");
  const [rows, setRows] = useState<Balance[] | null>(null);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [blind, setBlind] = useState(false);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useMemo(() => newIdempotencyKey(), []);
  const [attemptKey, setAttemptKey] = useState(key);
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  useEffect(() => {
    let live = true;
    void (async () => {
      setRows(null);
      const out: Balance[] = [];
      for (let page = 1; page <= 10; page++) {
        const { data } = await browserApi().GET("/v1/partner/factories/{factoryId}/erp/stock", {
          params: { path: { factoryId }, query: { warehouseId, page, perPage: 100 } },
        });
        if (!data) break;
        out.push(...data.data);
        if (out.length >= data.meta.total) break;
      }
      if (live) setRows(out.sort((a, b) => a.item.sku.localeCompare(b.item.sku)));
    })().catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [factoryId, warehouseId]);

  const needle = query.trim().toLocaleLowerCase(locale);
  const lines = (rows ?? []).map((row) => {
    const value = counted[row.item.id] ?? "";
    const valid = value !== "" && QTY_PATTERN.test(plainNumber(value));
    const diff = valid ? milli(value) - milli(row.onHand) : null;
    return { row, value, valid, diff, lots: byId.get(row.item.id)?.trackLots ?? false };
  });
  const shown = lines.filter(
    (l) =>
      (!needle || `${l.row.item.sku} ${l.row.item.name}`.toLocaleLowerCase(locale).includes(needle)) &&
      (!onlyDiff || (l.diff !== null && l.diff !== 0n)),
  );
  const entered = lines.filter((l) => l.valid);
  const changed = entered.filter((l) => l.diff !== 0n);
  const invalid = lines.some((l) => l.value !== "" && !l.valid);

  async function submit() {
    if (!entered.length) return toast.error(t("nothingCounted"));
    if (invalid) return toast.error(tMove("qtyInvalid"));
    if (!reason.trim()) return toast.error(tMove("reasonRequired"));
    setBusy(true);
    try {
      const { data } = await browserApi().POST("/v1/partner/factories/{factoryId}/erp/stock/actions/adjust", {
        params: { path: { factoryId }, header: { "Idempotency-Key": attemptKey } },
        body: {
          kind: "count",
          warehouseId,
          reason: reason.trim(),
          lines: entered.map((l) => ({ itemId: l.row.item.id, quantity: plainNumber(l.value) })),
        },
      });
      if (data?.documentNo) toast.success(tMove("posted", { no: data.documentNo }));
      else toast.info(tMove("nothingChanged"));
      router.push("/stock?view=movements");
      router.refresh();
    } catch (error) {
      setAttemptKey(newIdempotencyKey());
      toast.error(problemMessage(error, tCommon("failed")));
    } finally {
      setBusy(false);
    }
  }

  const unitOf = (code: string) => (tCommon.has(`units.${code}` as never) ? tCommon(`units.${code}` as never) : code);
  const submitButton = (
    <Button size="xl" iconStart="save" loading={busy} disabled={!entered.length} onClick={() => void submit()}>
      {t("submit", { count: entered.length })}
    </Button>
  );
  return (
    // The sheet on the left; what has been counted, the reason and the one save in a panel that stays in view.
    <FormColumns
      aside={
        <FormSummary title={tSections("summary")} action={submitButton} className="print:hidden">
          <p className="text-muted text-sm" aria-live="polite">
            {t("summary", { counted: entered.length, total: lines.length, changed: changed.length })}
          </p>
          <Field label={tMove("reason")} required requiredLabel={tCommon("required")}>
            <Textarea
              rows={3}
              value={reason}
              placeholder={t("reasonPlaceholder")}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </FormSummary>
      }
    >
      <div className="grid gap-3 md:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)] print:hidden">
        <Field label={tCommon("warehouse")}>
          <Select
            value={warehouseId}
            onValueChange={(v) => (setWarehouseId(v), setCounted({}))}
            options={warehouses.map((w) => ({ value: w.id, label: w.name, description: w.code }))}
          />
        </Field>
        <Field label={t("search")}>
          <Input
            type="search"
            value={query}
            placeholder={t("searchPlaceholder")}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4 print:hidden">
        <Checkbox label={t("blind")} checked={blind} onCheckedChange={(v) => setBlind(v === true)} />
        <Checkbox label={t("onlyDiff")} checked={onlyDiff} onCheckedChange={(v) => setOnlyDiff(v === true)} />
        <Button variant="secondary" iconStart="printer" onClick={() => window.print()}>
          {t("print")}
        </Button>
      </div>
      {rows === null ? (
        <p className="text-muted">{t("loading")}</p>
      ) : rows.length === 0 ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <caption className="sr-only">{t("caption")}</caption>
            <thead className="bg-surface-subtle text-muted text-xs">
              <tr>
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  {t("item")}
                </th>
                {!blind ? (
                  <th scope="col" className="px-3 py-2 text-end font-medium max-md:hidden">
                    {t("system")}
                  </th>
                ) : null}
                <th scope="col" className="w-28 px-3 py-2 text-end font-medium md:w-40">
                  {t("counted")}
                </th>
                {!blind ? (
                  <th scope="col" className="px-3 py-2 text-end font-medium">
                    {t("difference")}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => (
                <tr key={l.row.item.id} className="border-border border-t">
                  <td className="px-3 py-2">
                    <span className="block">{l.row.item.name}</span>
                    <span className="text-muted text-xs tabular-nums">{l.row.item.sku}</span>
                    {l.lots ? <span className="text-muted block text-xs">{t("byLot")}</span> : null}
                    {/* On a phone the system figure sits under the name instead of in its own column. */}
                    {!blind ? (
                      <span className="text-muted block text-xs tabular-nums md:hidden">
                        {t("system")} {formatQty(l.row.onHand, locale)} {unitOf(l.row.item.baseUnit)}
                      </span>
                    ) : null}
                  </td>
                  {!blind ? (
                    <td className="px-3 py-2 text-end whitespace-nowrap tabular-nums max-md:hidden">
                      {formatQty(l.row.onHand, locale)} {unitOf(l.row.item.baseUnit)}
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    <Input
                      inputMode="decimal"
                      aria-label={t("countedFor", { item: l.row.item.name })}
                      value={l.value}
                      disabled={l.lots}
                      aria-invalid={l.value !== "" && !l.valid}
                      className="text-end print:border-0"
                      onChange={(e) => setCounted({ ...counted, [l.row.item.id]: e.target.value })}
                    />
                  </td>
                  {!blind ? (
                    <td
                      className={cn(
                        "px-3 py-2 text-end font-medium tabular-nums",
                        l.diff === null ? "text-muted" : l.diff === 0n ? "text-success" : "text-warning-subtle-fg",
                      )}
                    >
                      {l.diff === null ? "—" : l.diff === 0n ? t("match") : fromMilli(l.diff)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </FormColumns>
  );
}
