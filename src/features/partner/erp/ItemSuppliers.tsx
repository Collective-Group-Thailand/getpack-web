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

import { ERP_SUPPLIER_APPROVAL } from "@/domain/status";
import { ConfirmAction } from "@/features/shared/actions";
import { StatusChip } from "@/features/partner/status";
import { IconButton } from "@/ui/components/IconButton";

import { useErpCall } from "./call";
import { formatPlain, formatQty, plainNumber, PRICE_PATTERN, QTY_PATTERN } from "./format";
import { ERP_UNIT_VALUES } from "./units";

type Link = Schemas["ErpItemSupplierDto"];
type Item = Pick<Schemas["ErpItemDto"], "id" | "baseUnit" | "purchaseUnit" | "purchaseFactor">;
type Supplier = Pick<Schemas["ErpTradingPartnerDto"], "id" | "code" | "name">;
type Unit = Link["purchaseUnit"];

const GRADE_TONE: Record<string, "success" | "info" | "warning" | "danger"> = {
  A: "success",
  B: "info",
  C: "warning",
  D: "danger",
};

const UNITS = ERP_UNIT_VALUES;

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
  canApprove = false,
  locale,
}: {
  item: Item & { name?: string };
  links: Link[];
  suppliers: Supplier[];
  canManage: boolean;
  /** `factory_procurement.approve`: the approved supplier list (D-351). */
  canApprove?: boolean;
  locale: string;
}) {
  const t = useTranslations("partnerFactory.prices");
  const tCommon = useTranslations("partnerErp.common");
  const tOps = useTranslations("partnerOps");
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
                  <StatusChip map={ERP_SUPPLIER_APPROVAL} value={link.approval} />
                  {link.score.grade ? (
                    <Badge tone={GRADE_TONE[link.score.grade] ?? "neutral"}>
                      {tOps("sourcing.grade", { grade: link.score.grade })}
                    </Badge>
                  ) : null}
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
              <LinkSourcing
                link={link}
                item={item}
                canManage={canManage && !archived}
                canApprove={canApprove && !archived}
                locale={locale}
              />
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

/**
 * The link's sourcing (D-346, D-351): its standing on the approved supplier list with who approved it and when
 * to review, its quantity breaks, and — for an approver — approve or suspend; for a buyer, edit the breaks.
 */
function LinkSourcing({
  link,
  item,
  canManage,
  canApprove,
  locale,
}: {
  link: Link;
  item: Item & { name?: string };
  canManage: boolean;
  canApprove: boolean;
  locale: string;
}) {
  const t = useTranslations("partnerOps.sourcing");
  const tCommon = useTranslations("partnerErp.common");
  const format = useFormat();
  const { factoryId } = useFactory();
  const { call } = useErpCall();
  const [open, setOpen] = useState<"approve" | "suspend" | "breaks" | null>(null);
  const [reviewOn, setReviewOn] = useState("");
  const unit = (code: string) => tCommon(`units.${code}` as never);
  const path = { factoryId, itemId: item.id, linkId: link.id };
  const name = link.supplier.name;
  const itemName = item.name ?? link.item.name;

  return (
    <div className="border-border flex flex-col gap-2 border-t pt-3 text-sm">
      {link.approval === "approved" && link.approvedBy && link.approvedAt ? (
        <p className="text-muted">
          {t("approvedBy", { name: link.approvedBy, at: format.date(link.approvedAt) })}
          {link.reviewOn ? ` · ${t("reviewBy", { date: format.date(link.reviewOn) })}` : ""}
        </p>
      ) : null}
      {link.approvalNote ? <p className="text-muted">{link.approvalNote}</p> : null}
      {link.priceBreaks.length ? (
        <div>
          <p className="font-medium">{t("breaks")}</p>
          <ul className="flex flex-wrap gap-2">
            {link.priceBreaks.map((b) => (
              <li key={b.minQty} className="bg-surface-subtle rounded-lg px-2 py-1 tabular-nums">
                {[
                  t("breakFrom", { qty: `${formatQty(b.minQty, locale)} ${unit(link.purchaseUnit)}` }),
                  `${format.thb(b.unitPrice)}`,
                ].join(" · ")}
              </li>
            ))}
          </ul>
          {link.breaksValidUntil ? (
            <p className="text-muted">{t("reviewBy", { date: format.date(link.breaksValidUntil) })}</p>
          ) : null}
        </div>
      ) : null}
      {canManage || canApprove ? (
        <div className="flex flex-wrap gap-2">
          {canApprove && link.approval !== "approved" ? (
            <Button size="sm" variant="secondary" iconStart="shield-check" onClick={() => setOpen("approve")}>
              {t("approve")}
            </Button>
          ) : null}
          {canApprove && link.approval !== "suspended" ? (
            <Button size="sm" variant="ghost" iconStart="ban" onClick={() => setOpen("suspend")}>
              {t("suspend")}
            </Button>
          ) : null}
          {canManage ? (
            <Button
              size="sm"
              variant="ghost"
              iconStart="layers"
              onClick={() => setOpen(open === "breaks" ? null : "breaks")}
            >
              {t("editBreaks")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {open === "breaks" ? (
        <BreaksForm link={link} itemId={item.id} locale={locale} onDone={() => setOpen(null)} />
      ) : null}
      <ConfirmAction
        open={open === "approve"}
        onOpenChange={(next) => !next && setOpen(null)}
        title={t("approveTitle", { name, item: itemName })}
        description={t("approveBody")}
        confirmLabel={t("approveConfirm")}
        reason={{ label: t("approvalNote"), required: false }}
        onConfirm={async ({ idempotencyKey, reason }) => {
          await call(
            async () =>
              (
                await browserApi().POST(
                  "/v1/partner/factories/{factoryId}/erp/items/{itemId}/suppliers/{linkId}/actions/approve",
                  {
                    params: { path, header: { "Idempotency-Key": idempotencyKey } },
                    body: { note: reason.trim() || null, reviewOn: reviewOn || null },
                  },
                )
              ).data,
            t("approved"),
          );
          setOpen(null);
        }}
      >
        <Field label={t("reviewOn")}>
          <Input
            type="date"
            min={bangkokToday()}
            value={reviewOn}
            onChange={(event) => setReviewOn(event.target.value)}
          />
        </Field>
      </ConfirmAction>
      <ConfirmAction
        open={open === "suspend"}
        onOpenChange={(next) => !next && setOpen(null)}
        tone="destructive"
        title={t("suspendTitle", { name, item: itemName })}
        description={t("suspendBody")}
        confirmLabel={t("suspendConfirm")}
        reason={{ label: t("suspendReason"), required: true, minLength: 3 }}
        onConfirm={async ({ idempotencyKey, reason }) => {
          await call(
            async () =>
              (
                await browserApi().POST(
                  "/v1/partner/factories/{factoryId}/erp/items/{itemId}/suppliers/{linkId}/actions/suspend",
                  { params: { path, header: { "Idempotency-Key": idempotencyKey } }, body: { reason } },
                )
              ).data,
            t("suspended"),
          );
          setOpen(null);
        }}
      />
    </div>
  );
}

interface BreakRow {
  key: number;
  minQty: string;
  unitPrice: string;
}

/** The link's quantity breaks, replaced as a set, with the date they hold until (D-346). */
function BreaksForm({
  link,
  itemId,
  locale,
  onDone,
}: {
  link: Link;
  itemId: string;
  locale: string;
  onDone: () => void;
}) {
  const t = useTranslations("partnerOps.sourcing");
  const tCommon = useTranslations("partnerErp.common");
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  const unit = tCommon(`units.${link.purchaseUnit}` as never);
  const [rows, setRows] = useState<BreakRow[]>(() =>
    link.priceBreaks.length
      ? link.priceBreaks.map((b, i) => ({
          key: i,
          minQty: formatQty(b.minQty, locale).replace(/,/g, ""),
          unitPrice: b.unitPrice.replace(/\.?0+$/, ""),
        }))
      : [{ key: 0, minQty: "", unitPrice: "" }],
  );
  const [validUntil, setValidUntil] = useState(link.breaksValidUntil ?? "");
  const [error, setError] = useState<string>();
  const used = rows.filter((r) => r.minQty || r.unitPrice);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const mins = used.map((r) => plainNumber(r.minQty));
    if (
      used.some((r) => !QTY_PATTERN.test(plainNumber(r.minQty)) || !PRICE_PATTERN.test(plainNumber(r.unitPrice))) ||
      new Set(mins.map((m) => Number(m))).size !== mins.length
    ) {
      setError(t("breaksInvalid"));
      return;
    }
    setError(undefined);
    const ok = await call(
      async () =>
        (
          await browserApi().PUT(
            "/v1/partner/factories/{factoryId}/erp/items/{itemId}/suppliers/{linkId}/price-breaks",
            {
              params: { path: { factoryId, itemId, linkId: link.id }, header: { "If-Match": "*" } },
              body: {
                breaks: used.map((r) => ({ minQty: plainNumber(r.minQty), unitPrice: plainNumber(r.unitPrice) })),
                validUntil: validUntil || null,
              },
            },
          )
        ).data,
      t("breaksSaved"),
    );
    if (ok) onDone();
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-3" noValidate>
      <p className="text-muted">{t("breaksHint")}</p>
      <ol className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li key={row.key} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <Field label={t("minQty")}>
              <NumberInput
                step="any"
                min={0}
                unit={unit}
                value={row.minQty}
                onChange={(event) =>
                  setRows(rows.map((r) => (r.key === row.key ? { ...r, minQty: event.target.value } : r)))
                }
              />
            </Field>
            <Field label={t("unitPrice", { unit })}>
              <NumberInput
                step="any"
                min={0}
                unit="฿"
                value={row.unitPrice}
                onChange={(event) =>
                  setRows(rows.map((r) => (r.key === row.key ? { ...r, unitPrice: event.target.value } : r)))
                }
              />
            </Field>
            <IconButton
              name="trash"
              label={t("removeBreak", { n: index + 1 })}
              onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
            />
          </li>
        ))}
      </ol>
      {error ? <p className="text-danger text-sm">{error}</p> : null}
      <div className="flex flex-wrap items-end gap-3">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          iconStart="plus"
          disabled={rows.length >= 20}
          onClick={() =>
            setRows([...rows, { key: Math.max(0, ...rows.map((r) => r.key)) + 1, minQty: "", unitPrice: "" }])
          }
        >
          {t("addBreak")}
        </Button>
        <Field label={t("validUntil")}>
          <Input
            type="date"
            min={bangkokToday()}
            value={validUntil}
            onChange={(event) => setValidUntil(event.target.value)}
          />
        </Field>
        <Button type="submit" size="sm" iconStart="save" loading={busy}>
          {t("saveBreaks")}
        </Button>
      </div>
    </form>
  );
}
