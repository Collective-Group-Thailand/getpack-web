"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { bangkokToday } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { FormColumns, FormSummary, SummaryRows } from "@/features/partner/form-layout";
import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field, FormSection } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";

import { useErpCall } from "./call";
import { isZero, plainNumber, QTY_PATTERN, trimZeros } from "./format";
import { type Line, type LineErrors, LinesEditor, newLine, type PickItem } from "./LinesEditor";

type Pr = Schemas["ErpPurchaseRequestDto"];

/**
 * A purchase request (D-336): what is needed, how much in the item's own unit, and by when. Prices and
 * suppliers come from each item's usual supplier when purchasing turns it into orders (D-335).
 */
export function RequestForm({
  request,
  etag,
  items,
  locale,
  initialItemId,
}: {
  request?: Pr;
  etag?: string | null;
  items: PickItem[];
  locale: string;
  initialItemId?: string;
}) {
  const t = useTranslations("partnerFactory.requests");
  const tCommon = useTranslations("partnerErp.common");
  const tSections = useTranslations("partnerErp.common.sections");
  const format = useFormat();
  const { factoryId } = useFactory();
  const router = useRouter();
  const { call, busy } = useErpCall();
  const [neededBy, setNeededBy] = useState(request?.neededBy ?? "");
  const [note, setNote] = useState(request?.note ?? "");
  const [lines, setLines] = useState<Line[]>(() =>
    request?.lines.length
      ? request.lines.map((line) => newLine({ itemId: line.item.id, quantity: trimZeros(line.quantity) }))
      : [newLine({ itemId: initialItemId ?? "" })],
  );
  const [errors, setErrors] = useState<LineErrors>({});

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const next: LineErrors = {};
    lines.forEach((line, index) => {
      const error: LineErrors[number] = {};
      if (!line.itemId) error.itemId = tCommon("selectItem");
      const quantity = plainNumber(line.quantity);
      if (!QTY_PATTERN.test(quantity) || isZero(quantity)) error.quantity = tCommon("qtyPlaceholder");
      if (Object.keys(error).length) next[index] = error;
    });
    setErrors(next);
    if (Object.keys(next).length) return;
    const body: Schemas["ErpSavePurchaseRequestDto"] = {
      neededBy: neededBy || null,
      note: note.trim() || null,
      lines: lines.map((line) => ({ itemId: line.itemId, quantity: plainNumber(line.quantity) })),
    };
    const saved = await call(
      async () =>
        request
          ? (
              await browserApi().PUT("/v1/partner/factories/{factoryId}/erp/purchase-requests/{prId}", {
                params: { path: { factoryId, prId: request.id }, header: { "If-Match": etag ?? "" } },
                body,
              })
            ).data
          : (
              await browserApi().POST("/v1/partner/factories/{factoryId}/erp/purchase-requests", {
                params: { path: { factoryId } },
                body,
              })
            ).data,
      t("saved"),
      { refresh: false },
    );
    if (saved) {
      router.push(`/purchasing/requests/${saved.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} noValidate>
      <FormColumns
        aside={
          <FormSummary
            title={tSections("summary")}
            action={
              <Button type="submit" size="xl" loading={busy} iconStart="save">
                {t("save")}
              </Button>
            }
          >
            <SummaryRows
              rows={[
                { key: "lines", label: tSections("lines"), value: String(lines.filter((line) => line.itemId).length) },
                { key: "needed", label: t("neededBy"), value: neededBy ? format.date(neededBy) : "" },
              ]}
            />
          </FormSummary>
        }
      >
        <FormSection card step={1} title={tSections("lines")}>
          <LinesEditor
            items={items}
            lines={lines}
            onChange={setLines}
            errors={errors}
            locale={locale}
            quantityLabel={t("quantity")}
          />
        </FormSection>
        <FormSection card step={2} title={tSections("references")}>
          <div className="grid gap-4 md:grid-cols-2">
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
        </FormSection>
      </FormColumns>
    </form>
  );
}
