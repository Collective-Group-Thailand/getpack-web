"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { bangkokToday } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { Select } from "@/features/partner/select";
import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput } from "@/ui/components/Input";

import { useErpCall } from "./call";
import { formatPlain, formatQty, plainNumber, PRICE_PATTERN, QTY_PATTERN } from "./format";

type Link = Schemas["ErpItemSupplierDto"];
type Item = Pick<Schemas["ErpItemDto"], "id" | "baseUnit" | "purchaseUnit" | "purchaseFactor">;
type Supplier = Pick<Schemas["ErpTradingPartnerDto"], "id" | "code" | "name">;
type Unit = Link["purchaseUnit"];

const UNITS = ["kg", "g", "ton", "sheet", "ream", "roll", "m", "m2", "pcs", "box", "pack", "set", "l", "ml"] as const;

/**
 * Who sells this item and for how much (D-333 – D-335): one card per supplier with its unit, latest price
 * (also per base unit, so suppliers selling in different units compare), the 12-month range and trend,
 * delivery record and badges for the usual and the cheapest supplier; the usual supplier can be changed, a
 * quoted price noted, and a supplier added or archived. Figures come from the API as they are.
 */
export function ItemSuppliers({
  item,
  links,
  suppliers,
  canManage,
  locale,
}: {
  item: Item;
  links: Link[];
  suppliers: Supplier[];
  canManage: boolean;
  locale: string;
}) {
  const t = useTranslations("partnerFactory.prices");
  const tCommon = useTranslations("partnerErp.common");
  const format = useFormat();
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  const [adding, setAdding] = useState(false);
  const [quoting, setQuoting] = useState<string | null>(null);
  const unit = (code: string) => tCommon(`units.${code}` as never);
  const path = { factoryId, itemId: item.id };

  const patch = (link: Link, body: Schemas["ErpUpdateItemSupplierDto"], done: string) =>
    call(
      () =>
        browserApi().PATCH("/v1/partner/factories/{factoryId}/erp/items/{itemId}/suppliers/{linkId}", {
          params: { path: { ...path, linkId: link.id }, header: { "If-Match": "*" } },
          body,
        }),
      done,
    );

  const linked = new Set(links.map((link) => link.supplier.id));

  return (
    <div className="flex flex-col gap-3">
      {links.length === 0 ? <p className="text-muted">{t("none")}</p> : null}
      <ul className="grid gap-3 lg:grid-cols-2">
        {links.map((link) => {
          const archived = link.status === "archived";
          return (
            <li
              key={link.id}
              className={`border-border bg-surface flex flex-col gap-3 rounded-xl border p-4 ${archived ? "opacity-70" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{link.supplier.name}</p>
                  <p className="text-muted text-sm">
                    {link.supplier.code}
                    {link.supplierSku ? ` · ${t("theirCode", { code: link.supplierSku })}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {link.preferred ? <Badge tone="primary">{t("preferred")}</Badge> : null}
                  {link.cheapest ? <Badge tone="success">{t("cheapest")}</Badge> : null}
                  {archived ? <Badge tone="neutral">{tCommon("archived")}</Badge> : null}
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted">{t("lastPrice")}</dt>
                  <dd className="text-base font-semibold tabular-nums">
                    {link.lastPrice
                      ? t("perUnit", { price: format.thb(link.lastPrice), unit: unit(link.purchaseUnit) })
                      : "—"}
                  </dd>
                  {link.lastBaseUnitPrice && link.purchaseUnit !== item.baseUnit ? (
                    <dd className="text-muted tabular-nums">
                      {t("perUnit", { price: format.thb(link.lastBaseUnitPrice), unit: unit(item.baseUnit) })}
                    </dd>
                  ) : null}
                </div>
                <div>
                  <dt className="text-muted">{t("sellsIn")}</dt>
                  <dd>
                    {link.purchaseUnit === item.baseUnit
                      ? unit(link.purchaseUnit)
                      : t("unitOf", {
                          unit: unit(link.purchaseUnit),
                          factor: formatQty(link.purchaseFactor, locale),
                          base: unit(item.baseUnit),
                        })}
                  </dd>
                  {link.minOrderQty ? (
                    <dd className="text-muted">
                      {t("minOrder", { qty: formatQty(link.minOrderQty, locale), unit: unit(link.purchaseUnit) })}
                    </dd>
                  ) : null}
                </div>
                <div>
                  <dt className="text-muted">{t("range")}</dt>
                  <dd className="tabular-nums">
                    {link.stats.minBaseUnitPrice && link.stats.maxBaseUnitPrice
                      ? `${format.thb(link.stats.minBaseUnitPrice)} – ${format.thb(link.stats.maxBaseUnitPrice)}`
                      : "—"}
                  </dd>
                  {link.stats.avgBaseUnitPrice ? (
                    <dd className="text-muted tabular-nums">
                      {t("average", { price: format.thb(link.stats.avgBaseUnitPrice), unit: unit(item.baseUnit) })}
                    </dd>
                  ) : null}
                </div>
                <div>
                  <dt className="text-muted">{t("change")}</dt>
                  <dd
                    className={
                      link.stats.changePct?.startsWith("-")
                        ? "text-success"
                        : link.stats.changePct && link.stats.changePct !== "0.00"
                          ? "text-danger"
                          : undefined
                    }
                  >
                    {link.stats.changePct
                      ? `${link.stats.changePct.startsWith("-") ? "" : "+"}${formatPlain(link.stats.changePct, locale, 2)}%`
                      : "—"}
                  </dd>
                  <dd className="text-muted">{t("purchases", { n: link.stats.purchases })}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t("delivery")}</dt>
                  <dd>
                    {link.stats.onTimePct ? t("onTime", { pct: formatPlain(link.stats.onTimePct, locale, 0) }) : "—"}
                  </dd>
                  {link.stats.avgLeadDays ? (
                    <dd className="text-muted">
                      {t("leadDays", { days: formatPlain(link.stats.avgLeadDays, locale, 1) })}
                    </dd>
                  ) : null}
                </div>
                <div>
                  <dt className="text-muted">{t("dates")}</dt>
                  <dd>{link.lastPurchasedOn ? t("boughtOn", { date: format.date(link.lastPurchasedOn) }) : "—"}</dd>
                  {link.quoteValidUntil ? (
                    <dd className="text-muted">{t("quoteUntil", { date: format.date(link.quoteValidUntil) })}</dd>
                  ) : null}
                </div>
              </dl>
              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  {!link.preferred && !archived ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      iconStart="star"
                      loading={busy}
                      onClick={() => void patch(link, { preferred: true }, t("preferredSet"))}
                    >
                      {t("makePreferred")}
                    </Button>
                  ) : null}
                  {!archived ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      iconStart="tag"
                      onClick={() => setQuoting(quoting === link.id ? null : link.id)}
                    >
                      {t("noteQuote")}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    iconStart={archived ? "undo" : "archive"}
                    loading={busy}
                    onClick={() => void patch(link, { status: archived ? "active" : "archived" }, tCommon("saved"))}
                  >
                    {archived ? t("restore") : t("archive")}
                  </Button>
                </div>
              ) : null}
              {quoting === link.id ? (
                <QuoteForm
                  itemId={item.id}
                  supplierId={link.supplier.id}
                  unitLabel={unit(link.purchaseUnit)}
                  onDone={() => setQuoting(null)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      {canManage ? (
        adding ? (
          <AddSupplierForm
            item={item}
            suppliers={suppliers.filter((s) => !linked.has(s.id))}
            onDone={() => setAdding(false)}
          />
        ) : (
          <Button variant="secondary" iconStart="plus" className="self-start" onClick={() => setAdding(true)}>
            {t("add")}
          </Button>
        )
      ) : null}
    </div>
  );
}

/** A quoted price (or one noted by hand), with how long it holds (D-334). */
function QuoteForm({
  itemId,
  supplierId,
  unitLabel,
  onDone,
}: {
  itemId: string;
  supplierId: string;
  unitLabel: string;
  onDone: () => void;
}) {
  const t = useTranslations("partnerFactory.prices");
  const tCommon = useTranslations("partnerErp.common");
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  const [price, setPrice] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [documentNo, setDocumentNo] = useState("");
  const [error, setError] = useState<string>();

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const value = plainNumber(price);
    if (!PRICE_PATTERN.test(value)) {
      setError(tCommon("pricePlaceholder"));
      return;
    }
    setError(undefined);
    const ok = await call(
      () =>
        browserApi().POST("/v1/partner/factories/{factoryId}/erp/items/{itemId}/prices", {
          params: { path: { factoryId, itemId } },
          body: {
            supplierId,
            source: "quotation",
            unitPrice: value,
            validUntil: validUntil || null,
            documentNo: documentNo.trim() || null,
          },
        }),
      t("quoteSaved"),
    );
    if (ok) onDone();
  }

  return (
    <form
      onSubmit={(event) => void save(event)}
      className="border-border grid gap-3 border-t pt-3 sm:grid-cols-3"
      noValidate
    >
      <Field label={t("quotePrice", { unit: unitLabel })} error={error}>
        <NumberInput step="any" min={0} unit="฿" value={price} onChange={(event) => setPrice(event.target.value)} />
      </Field>
      <Field label={t("validUntil")}>
        <Input
          type="date"
          min={bangkokToday()}
          value={validUntil}
          onChange={(event) => setValidUntil(event.target.value)}
        />
      </Field>
      <Field label={t("quoteNo")}>
        <Input
          value={documentNo}
          placeholder={t("quoteNoPlaceholder")}
          onChange={(event) => setDocumentNo(event.target.value)}
        />
      </Field>
      <Button type="submit" loading={busy} iconStart="save" className="self-start sm:col-span-3">
        {t("saveQuote")}
      </Button>
    </form>
  );
}

/** Adds a supplier for the item in the unit it sells in, optionally with a quoted price (D-333). */
function AddSupplierForm({ item, suppliers, onDone }: { item: Item; suppliers: Supplier[]; onDone: () => void }) {
  const t = useTranslations("partnerFactory.prices");
  const tCommon = useTranslations("partnerErp.common");
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  const [supplierId, setSupplierId] = useState("");
  const [unitCode, setUnitCode] = useState<string>(item.purchaseUnit ?? item.baseUnit);
  const [factor, setFactor] = useState(item.purchaseUnit ? item.purchaseFactor.replace(/\.?0+$/, "") : "1");
  const [sku, setSku] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [lead, setLead] = useState("");
  const [price, setPrice] = useState("");
  const [preferred, setPreferred] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const unit = (code: string) => tCommon(`units.${code}` as never);
  const other = unitCode !== item.baseUnit;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!supplierId) next.supplier = tCommon("selectSupplier");
    if (other && !PRICE_PATTERN.test(plainNumber(factor))) next.factor = t("factorRequired");
    if (minOrder && !QTY_PATTERN.test(plainNumber(minOrder))) next.minOrder = tCommon("qtyPlaceholder");
    if (price && !PRICE_PATTERN.test(plainNumber(price))) next.price = tCommon("pricePlaceholder");
    setErrors(next);
    if (Object.keys(next).length) return;
    const ok = await call(
      () =>
        browserApi().POST("/v1/partner/factories/{factoryId}/erp/items/{itemId}/suppliers", {
          params: { path: { factoryId, itemId: item.id } },
          body: {
            supplierId,
            purchaseUnit: unitCode as Unit,
            ...(other ? { purchaseFactor: plainNumber(factor) } : {}),
            supplierSku: sku.trim() || null,
            minOrderQty: minOrder ? plainNumber(minOrder) : null,
            leadTimeDays: lead ? Number.parseInt(lead, 10) : null,
            preferred,
            ...(price ? { price: plainNumber(price) } : {}),
          },
        }),
      t("added"),
    );
    if (ok) onDone();
  }

  if (!suppliers.length) return <p className="text-muted">{t("allLinked")}</p>;

  return (
    <form
      onSubmit={(event) => void save(event)}
      className="border-border bg-surface flex flex-col gap-4 rounded-xl border p-4"
      noValidate
    >
      <h3 className="text-base font-semibold">{t("add")}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("supplier")} required requiredLabel={tCommon("required")} error={errors.supplier}>
          <Select
            value={supplierId || null}
            placeholder={tCommon("selectSupplier")}
            onValueChange={setSupplierId}
            options={suppliers.map((s) => ({ value: s.id, label: s.name, description: s.code }))}
          />
        </Field>
        <Field label={t("theirCodeLabel")}>
          <Input value={sku} placeholder={t("theirCodePlaceholder")} onChange={(event) => setSku(event.target.value)} />
        </Field>
        <Field label={t("sellsIn")}>
          <Select
            value={unitCode}
            onValueChange={(next) => {
              setUnitCode(next);
              if (next === item.purchaseUnit) setFactor(item.purchaseFactor.replace(/\.?0+$/, ""));
            }}
            options={UNITS.map((code) => ({ value: code, label: unit(code) }))}
          />
        </Field>
        {other ? (
          <Field label={t("factor", { unit: unit(unitCode), base: unit(item.baseUnit) })} error={errors.factor}>
            <NumberInput
              step="any"
              min={0}
              unit={unit(item.baseUnit)}
              value={factor}
              onChange={(event) => setFactor(event.target.value)}
            />
          </Field>
        ) : null}
        <Field label={t("minOrderLabel")} error={errors.minOrder}>
          <NumberInput
            step="any"
            min={0}
            unit={unit(unitCode)}
            value={minOrder}
            onChange={(event) => setMinOrder(event.target.value)}
          />
        </Field>
        <Field label={t("leadLabel")}>
          <NumberInput
            min={0}
            max={365}
            step={1}
            unit={t("daysUnit")}
            value={lead}
            onChange={(event) => setLead(event.target.value)}
          />
        </Field>
        <Field label={t("quotePrice", { unit: unit(unitCode) })} hint={t("quotePriceHint")} error={errors.price}>
          <NumberInput step="any" min={0} unit="฿" value={price} onChange={(event) => setPrice(event.target.value)} />
        </Field>
      </div>
      <Checkbox
        label={t("makePreferred")}
        description={t("preferredHint")}
        checked={preferred}
        onCheckedChange={(checked) => setPreferred(checked === true)}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy} iconStart="save">
          {t("add")}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {tCommon("cancel")}
        </Button>
      </div>
    </form>
  );
}
