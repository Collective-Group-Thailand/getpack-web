"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ERP_RFQ_SUPPLIER_STATUS } from "@/domain/status";
import { bangkokToday } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { useErpCall } from "@/features/partner/erp/call";
import { formatQty, plainNumber, PRICE_PATTERN, QTY_PATTERN, trimZeros } from "@/features/partner/erp/format";
import { Select } from "@/features/partner/select";
import { StatusChip } from "@/features/partner/status";
import { ConfirmAction } from "@/features/shared/actions";
import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";

type Rfq = Schemas["ErpRfqDto"];
type RfqSupplier = Rfq["suppliers"][number];
type Unit = Schemas["ErpUnit"];

const UNITS: Unit[] = ["kg", "g", "ton", "sheet", "ream", "roll", "m", "m2", "pcs", "box", "pack", "set", "l", "ml"];
const USUAL = "usual";

interface Row {
  price: string;
  unit: string;
  factor: string;
  minOrder: string;
  lead: string;
  validUntil: string;
}

/**
 * The suppliers of a request for quotation and what each answered (D-348): their prices per line — recorded
 * here while the request is out, in the unit they quote (their usual unit for the item when left), with
 * minimum, lead time and validity — or that they declined.
 */
export function QuoteEntry({ rfq, locale, canRecord }: { rfq: Rfq; locale: string; canRecord: boolean }) {
  const t = useTranslations("partnerOps.rfqs");
  const tCommon = useTranslations("partnerErp.common");
  const format = useFormat();
  const [editing, setEditing] = useState<string | null>(null);
  const [declining, setDeclining] = useState<RfqSupplier | null>(null);
  const { factoryId } = useFactory();
  const { call } = useErpCall();
  const unit = (code: string) => tCommon(`units.${code}` as never);
  const lineOf = new Map(rfq.lines.map((l) => [l.id, l]));
  const open = rfq.status === "sent" && canRecord;

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid gap-3 lg:grid-cols-2">
        {rfq.suppliers.map((s) => (
          <li key={s.id} className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{s.supplier.name}</p>
                <p className="text-muted text-sm">
                  {[
                    s.supplier.code,
                    s.reference ? t("reference", { ref: s.reference }) : null,
                    s.respondedOn ? t("respondedOn", { date: format.date(s.respondedOn) }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <StatusChip map={ERP_RFQ_SUPPLIER_STATUS} value={s.status} />
            </div>
            {s.quotes.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {s.quotes.map((q) => {
                  const line = lineOf.get(q.rfqLineId);
                  return (
                    <li key={q.id} className="flex flex-wrap justify-between gap-2">
                      <span>{line ? `${line.lineNo}. ${line.item.name}` : "—"}</span>
                      <span className="tabular-nums">
                        {[
                          `${format.thb(q.unitPrice)}/${unit(q.unit)}`,
                          q.leadTimeDays !== null ? t("compare.leadDays", { n: q.leadTimeDays }) : null,
                          q.validUntil ? format.date(q.validUntil) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-muted text-sm">{s.status === "declined" ? (s.note ?? "") : t("noQuote")}</p>
            )}
            {open ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={s.status === "invited" ? "primary" : "secondary"}
                  iconStart="receipt"
                  onClick={() => setEditing(editing === s.id ? null : s.id)}
                >
                  {s.status === "quoted" ? t("recordAgain") : t("record")}
                </Button>
                {s.status !== "declined" ? (
                  <Button size="sm" variant="ghost" iconStart="ban" onClick={() => setDeclining(s)}>
                    {t("decline")}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {editing === s.id ? (
              <QuoteForm rfq={rfq} supplier={s} locale={locale} onDone={() => setEditing(null)} />
            ) : null}
          </li>
        ))}
      </ul>
      <ConfirmAction
        open={declining !== null}
        onOpenChange={(next) => !next && setDeclining(null)}
        tone="destructive"
        title={t("declineTitle", { name: declining?.supplier.name ?? "" })}
        description={t("declineBody")}
        confirmLabel={t("decline")}
        reason={{ label: t("actions.reason"), required: true, minLength: 3 }}
        onConfirm={async ({ idempotencyKey, reason }) => {
          if (!declining) return;
          await call(
            async () =>
              (
                await browserApi().POST(
                  "/v1/partner/factories/{factoryId}/erp/rfqs/{rfqId}/suppliers/{rfqSupplierId}/actions/decline",
                  {
                    params: {
                      path: { factoryId, rfqId: rfq.id, rfqSupplierId: declining.id },
                      header: { "Idempotency-Key": idempotencyKey },
                    },
                    body: { reason },
                  },
                )
              ).data,
            t("declined"),
          );
          setDeclining(null);
        }}
      />
    </div>
  );
}

function QuoteForm({
  rfq,
  supplier,
  locale,
  onDone,
}: {
  rfq: Rfq;
  supplier: RfqSupplier;
  locale: string;
  onDone: () => void;
}) {
  const t = useTranslations("partnerOps.rfqs");
  const tShared = useTranslations("partnerOps.shared");
  const tCommon = useTranslations("partnerErp.common");
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  const unit = (code: string) => tCommon(`units.${code}` as never);
  const [reference, setReference] = useState(supplier.reference ?? "");
  const [respondedOn, setRespondedOn] = useState(supplier.respondedOn ?? bangkokToday());
  const [note, setNote] = useState(supplier.note ?? "");
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      rfq.lines.map((line) => {
        const q = supplier.quotes.find((x) => x.rfqLineId === line.id);
        return [
          line.id,
          {
            price: q ? trimZeros(q.unitPrice) : "",
            unit: q ? q.unit : USUAL,
            factor: q ? trimZeros(q.factor) : "",
            minOrder: q?.minOrderQty ? trimZeros(q.minOrderQty) : "",
            lead: q?.leadTimeDays !== null && q?.leadTimeDays !== undefined ? String(q.leadTimeDays) : "",
            validUntil: q?.validUntil ?? "",
          },
        ];
      }),
    ),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (id: string, patch: Partial<Row>) => setRows({ ...rows, [id]: { ...rows[id]!, ...patch } });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    const quotes: Schemas["ErpQuoteInput"][] = [];
    for (const line of rfq.lines) {
      const r = rows[line.id]!;
      if (!r.price.trim()) continue;
      const price = plainNumber(r.price);
      if (!PRICE_PATTERN.test(price)) next[`${line.id}:price`] = tCommon("pricePlaceholder");
      const other = r.unit !== USUAL && r.unit !== line.item.baseUnit;
      if (other && r.factor && !PRICE_PATTERN.test(plainNumber(r.factor)))
        next[`${line.id}:factor`] = tCommon("qtyPlaceholder");
      if (r.minOrder && !QTY_PATTERN.test(plainNumber(r.minOrder))) next[`${line.id}:min`] = tCommon("qtyPlaceholder");
      quotes.push({
        rfqLineId: line.id,
        unitPrice: price,
        ...(r.unit !== USUAL ? { unit: r.unit as Unit } : {}),
        ...(other && r.factor ? { factor: plainNumber(r.factor) } : {}),
        minOrderQty: r.minOrder ? plainNumber(r.minOrder) : null,
        leadTimeDays: r.lead ? Math.max(0, Math.min(365, Number.parseInt(r.lead, 10) || 0)) : null,
        validUntil: r.validUntil || null,
      });
    }
    if (!quotes.length) next.form = t("quote.required");
    setErrors(next);
    if (Object.keys(next).length) return;
    const ok = await call(
      async () =>
        (
          await browserApi().PUT("/v1/partner/factories/{factoryId}/erp/rfqs/{rfqId}/suppliers/{rfqSupplierId}/quote", {
            params: { path: { factoryId, rfqId: rfq.id, rfqSupplierId: supplier.id } },
            body: { reference: reference.trim() || null, respondedOn, note: note.trim() || null, quotes },
          })
        ).data,
      t("quote.saved"),
    );
    if (ok) onDone();
  }

  return (
    <form onSubmit={(event) => void save(event)} className="border-border flex flex-col gap-4 border-t pt-3" noValidate>
      <h3 className="font-semibold">{t("recordTitle", { name: supplier.supplier.name })}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("quote.reference")}>
          <Input value={reference} onChange={(event) => setReference(event.target.value)} />
        </Field>
        <Field label={t("quote.respondedOn")}>
          <Input
            type="date"
            max={bangkokToday()}
            value={respondedOn}
            onChange={(event) => setRespondedOn(event.target.value || bangkokToday())}
          />
        </Field>
      </div>
      <ol className="flex flex-col gap-3">
        {rfq.lines.map((line) => {
          const r = rows[line.id]!;
          const other = r.unit !== USUAL && r.unit !== line.item.baseUnit;
          return (
            <li key={line.id} className="bg-surface-subtle flex flex-col gap-2 rounded-lg p-3">
              <p className="font-medium">
                {tShared("lineTitle", {
                  no: line.lineNo,
                  name: line.item.name,
                  qty: tCommon("inUnit", { qty: formatQty(line.quantity, locale), unit: unit(line.item.baseUnit) }),
                })}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label={t("quote.unitPrice")} hint={t("quote.skipLine")} error={errors[`${line.id}:price`]}>
                  <NumberInput
                    step="any"
                    min={0}
                    unit="฿"
                    value={r.price}
                    onChange={(event) => set(line.id, { price: event.target.value })}
                  />
                </Field>
                <Field label={t("quote.unit")}>
                  <Select
                    value={r.unit}
                    onValueChange={(value) => set(line.id, { unit: value })}
                    options={[
                      { value: USUAL, label: t("quote.usualUnit") },
                      ...UNITS.map((code) => ({ value: code, label: unit(code) })),
                    ]}
                  />
                </Field>
                {other ? (
                  <Field label={t("quote.factor")} error={errors[`${line.id}:factor`]}>
                    <NumberInput
                      step="any"
                      min={0}
                      unit={unit(line.item.baseUnit)}
                      value={r.factor}
                      onChange={(event) => set(line.id, { factor: event.target.value })}
                    />
                  </Field>
                ) : null}
                <Field label={t("quote.minOrder")} error={errors[`${line.id}:min`]}>
                  <NumberInput
                    step="any"
                    min={0}
                    value={r.minOrder}
                    onChange={(event) => set(line.id, { minOrder: event.target.value })}
                  />
                </Field>
                <Field label={t("quote.leadTime")}>
                  <NumberInput
                    step={1}
                    min={0}
                    max={365}
                    value={r.lead}
                    onChange={(event) => set(line.id, { lead: event.target.value })}
                  />
                </Field>
                <Field label={t("quote.validUntil")}>
                  <Input
                    type="date"
                    min={respondedOn}
                    value={r.validUntil}
                    onChange={(event) => set(line.id, { validUntil: event.target.value })}
                  />
                </Field>
              </div>
            </li>
          );
        })}
      </ol>
      <Field label={t("quote.note")}>
        <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      {errors.form ? <p className="text-danger text-sm">{errors.form}</p> : null}
      <Button type="submit" iconStart="save" loading={busy} className="self-start">
        {t("quote.save")}
      </Button>
    </form>
  );
}
