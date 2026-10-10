"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { bangkokToday } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { useErpCall } from "@/features/partner/erp/call";
import { isZero, plainNumber, QTY_PATTERN, trimZeros } from "@/features/partner/erp/format";
import { type Line, type LineErrors, LinesEditor, newLine, type PickItem } from "@/features/partner/erp/LinesEditor";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";

type Rfq = Schemas["ErpRfqDto"];
type Supplier = Pick<Schemas["ErpTradingPartnerDto"], "id" | "code" | "name">;

/**
 * A request for quotation (D-348): what to ask (items in base units), whom (up to 20 suppliers) and by when.
 * From an approved purchase request its open lines come in when none are typed.
 */
export function RfqForm({
  rfq,
  etag,
  items,
  suppliers,
  locale,
  request,
}: {
  rfq?: Rfq;
  etag?: string | null;
  items: PickItem[];
  suppliers: Supplier[];
  locale: string;
  /** An approved purchase request to start from. */
  request?: Pick<Schemas["ErpPurchaseRequestDto"], "id" | "prNo" | "lines" | "neededBy">;
}) {
  const t = useTranslations("partnerOps.rfqs.form");
  const tCommon = useTranslations("partnerErp.common");
  const { factoryId } = useFactory();
  const router = useRouter();
  const { call, busy } = useErpCall();
  const [title, setTitle] = useState(rfq?.title ?? (request ? t("fromRequest", { no: request.prNo }) : ""));
  const [quoteBy, setQuoteBy] = useState(rfq?.quoteBy ?? "");
  const [neededBy, setNeededBy] = useState(rfq?.neededBy ?? request?.neededBy ?? "");
  const [note, setNote] = useState(rfq?.note ?? "");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(rfq?.suppliers.map((s) => s.supplier.id) ?? []));
  const [lines, setLines] = useState<Line[]>(() =>
    rfq?.lines.length
      ? rfq.lines.map((l) => newLine({ itemId: l.item.id, quantity: trimZeros(l.quantity) }))
      : request
        ? request.lines
            .filter((l) => !l.purchaseOrder)
            .map((l) => newLine({ itemId: l.item.id, quantity: trimZeros(l.quantity) }))
        : [newLine()],
  );
  const [errors, setErrors] = useState<LineErrors>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const next: LineErrors = {};
    lines.forEach((line, index) => {
      const error: LineErrors[number] = {};
      if (!line.itemId) error.itemId = tCommon("selectItem");
      const q = plainNumber(line.quantity);
      if (!QTY_PATTERN.test(q) || isZero(q)) error.quantity = tCommon("qtyPlaceholder");
      if (Object.keys(error).length) next[index] = error;
    });
    const form: Record<string, string> = {};
    if (!title.trim()) form.title = t("subjectRequired");
    if (picked.size === 0) form.suppliers = t("suppliersRequired");
    setErrors(next);
    setFormErrors(form);
    if (Object.keys(next).length || Object.keys(form).length) return;
    const body: Schemas["ErpSaveRfqDto"] = {
      title: title.trim(),
      quoteBy: quoteBy || null,
      neededBy: neededBy || null,
      note: note.trim() || null,
      ...(request ? { purchaseRequestId: request.id } : {}),
      lines: lines.map((line) => ({ itemId: line.itemId, quantity: plainNumber(line.quantity) })),
      supplierIds: [...picked],
    };
    const saved = await call(
      async () =>
        rfq
          ? (
              await browserApi().PUT("/v1/partner/factories/{factoryId}/erp/rfqs/{rfqId}", {
                params: { path: { factoryId, rfqId: rfq.id }, header: { "If-Match": etag ?? "*" } },
                body,
              })
            ).data
          : (
              await browserApi().POST("/v1/partner/factories/{factoryId}/erp/rfqs", {
                params: { path: { factoryId } },
                body,
              })
            ).data,
      t("saved"),
      { refresh: false },
    );
    if (saved) {
      router.push(`/purchasing/rfqs/${saved.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-5" noValidate>
      <Field label={t("subject")} required requiredLabel={tCommon("required")} error={formErrors.title}>
        <Input value={title} placeholder={t("subjectPlaceholder")} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <LinesEditor
        items={items}
        lines={lines}
        onChange={setLines}
        errors={errors}
        locale={locale}
        quantityLabel={t("quantity")}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="font-semibold">{t("suppliers")}</legend>
        <p className="text-muted text-sm">{t("suppliersHint")}</p>
        {formErrors.suppliers ? <p className="text-danger text-sm">{formErrors.suppliers}</p> : null}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <Checkbox
              key={s.id}
              label={s.name}
              description={s.code}
              checked={picked.has(s.id)}
              disabled={!picked.has(s.id) && picked.size >= 20}
              onCheckedChange={(checked) => {
                const next = new Set(picked);
                if (checked === true) next.add(s.id);
                else next.delete(s.id);
                setPicked(next);
              }}
            />
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("quoteBy")}>
          <Input
            type="date"
            min={bangkokToday()}
            value={quoteBy}
            onChange={(event) => setQuoteBy(event.target.value)}
          />
        </Field>
        <Field label={t("neededBy")}>
          <Input
            type="date"
            min={bangkokToday()}
            value={neededBy}
            onChange={(event) => setNeededBy(event.target.value)}
          />
        </Field>
      </div>
      <Field label={t("note")}>
        <Textarea
          rows={2}
          value={note}
          placeholder={t("notePlaceholder")}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      <Button type="submit" size="xl" loading={busy} iconStart="save" className="self-start">
        {t("save")}
      </Button>
    </form>
  );
}
