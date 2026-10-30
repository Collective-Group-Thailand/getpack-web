"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { FormColumns, FormSummary, SummaryRows } from "@/features/partner/form-layout";
import { Select } from "@/features/partner/select";
import { problemMessage } from "@/features/shared/actions";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field, FormSection } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { isZero, plainNumber, PRICE_PATTERN, QTY_PATTERN, SIGNED_QTY_PATTERN } from "./format";
import { type Line, type LineErrors, LinesEditor, newLine, type PickItem } from "./LinesEditor";

type Warehouse = Pick<Schemas["ErpWarehouseDto"], "id" | "code" | "name" | "isDefault">;

export type MoveMode = "issue" | "count" | "transfer";
type Kind = "issue" | "return" | "count" | "adjustment" | "opening";

const KINDS: Record<MoveMode, Kind[]> = {
  issue: ["issue", "return"],
  count: ["count", "adjustment", "opening"],
  transfer: [],
};

/**
 * Issue / return, count / adjust / opening balance, and transfer between warehouses (D-321, D-322, D-324):
 * one form per task, its lines picked by item, posted in one idempotent call (one key per attempt, kept on a
 * retry). The API prices every movement at the moving average and refuses an issue beyond the stock.
 */
export function StockMoveForm({
  mode,
  items,
  warehouses,
  locale,
  initialItemId,
}: {
  mode: MoveMode;
  items: PickItem[];
  warehouses: Warehouse[];
  locale: string;
  initialItemId?: string;
}) {
  const t = useTranslations("partnerErp.move");
  const tCommon = useTranslations("partnerErp.common");
  const tSections = useTranslations("partnerErp.common.sections");
  const { factoryId } = useFactory();
  const router = useRouter();
  const main = warehouses.find((warehouse) => warehouse.isDefault) ?? warehouses[0];
  const [kind, setKind] = useState<Kind>(mode === "count" ? "count" : "issue");
  const [warehouseId, setWarehouseId] = useState(main?.id ?? "");
  const [toWarehouseId, setToWarehouseId] = useState(warehouses.find((w) => w.id !== main?.id)?.id ?? "");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<Line[]>(() => [newLine({ itemId: initialItemId ?? "" })]);
  const [errors, setErrors] = useState<LineErrors>({});
  const [reasonError, setReasonError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const key = useMemo(() => newIdempotencyKey(), []);
  const [attemptKey, setAttemptKey] = useState(key);
  const byId = new Map(items.map((item) => [item.id, item]));
  const signed = kind === "adjustment";
  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: w.name, description: w.code }));

  function check(): boolean {
    const next: LineErrors = {};
    lines.forEach((line, index) => {
      const error: LineErrors[number] = {};
      const quantity = plainNumber(line.quantity);
      if (!line.itemId) error.itemId = t("itemRequired");
      if (signed ? !SIGNED_QTY_PATTERN.test(quantity) || isZero(quantity) : !QTY_PATTERN.test(quantity))
        error.quantity = t("qtyInvalid");
      else if (kind !== "count" && !signed && isZero(quantity)) error.quantity = t("qtyRequired");
      if (kind === "opening" && line.price && !PRICE_PATTERN.test(plainNumber(line.price)))
        error.price = t("qtyInvalid");
      if (byId.get(line.itemId)?.trackLots && !line.lotNo?.trim()) error.lotNo = tCommon("lotHint");
      if (Object.keys(error).length) next[index] = error;
    });
    setErrors(next);
    const needsReason = kind === "count" || kind === "adjustment";
    setReasonError(needsReason && !reason.trim() ? t("reasonRequired") : undefined);
    return !Object.keys(next).length && !(needsReason && !reason.trim()) && lines.length > 0;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!check()) return;
    setBusy(true);
    const body = lines.map((line) => ({
      itemId: line.itemId,
      quantity: plainNumber(line.quantity),
      ...(kind === "opening" && line.price ? { unitCost: plainNumber(line.price) } : {}),
      ...(line.lotNo?.trim() ? { lotNo: line.lotNo.trim() } : {}),
    }));
    const header = { "Idempotency-Key": attemptKey };
    try {
      let posted: Schemas["ErpStockPostingDto"] | undefined;
      if (mode === "transfer") {
        posted = (
          await browserApi().POST("/v1/partner/factories/{factoryId}/erp/stock/actions/transfer", {
            params: { path: { factoryId }, header },
            body: { fromWarehouseId: warehouseId, toWarehouseId, reason: reason.trim() || null, lines: body },
          })
        ).data;
      } else if (mode === "issue") {
        posted = (
          await browserApi().POST("/v1/partner/factories/{factoryId}/erp/stock/actions/issue", {
            params: { path: { factoryId }, header },
            body: {
              kind: kind as "issue" | "return",
              warehouseId,
              reference: reference.trim() || null,
              reason: reason.trim() || null,
              lines: body,
            },
          })
        ).data;
      } else {
        posted = (
          await browserApi().POST("/v1/partner/factories/{factoryId}/erp/stock/actions/adjust", {
            params: { path: { factoryId }, header },
            body: {
              kind: kind as "opening" | "adjustment" | "count",
              warehouseId,
              reason: reason.trim() || null,
              lines: body,
            },
          })
        ).data;
      }
      if (posted?.documentNo) toast.success(t("posted", { no: posted.documentNo }));
      else toast.info(t("nothingChanged"));
      router.push(
        mode === "transfer" || lines.length > 1 ? "/stock?view=movements" : `/stock/items/${lines[0]!.itemId}`,
      );
      router.refresh();
    } catch (error) {
      // A refused attempt can be corrected and sent again: a new key, so the API does not replay the refusal.
      if (isApiError(error) && error.status < 500) setAttemptKey(newIdempotencyKey());
      if (isApiError(error))
        setErrors(
          Object.fromEntries(
            error.errors
              .map((e) => /^lines\.(\d+)\.(\w+)$/.exec(e.path))
              .filter((m): m is RegExpExecArray => Boolean(m))
              .map((m) => [Number(m[1]), { [m[2] === "unitCost" ? "price" : m[2]!]: t("qtyInvalid") }]),
          ),
        );
      toast.error(problemMessage(error, tCommon("failed")));
    } finally {
      setBusy(false);
    }
  }

  if (mode === "transfer" && warehouses.length < 2) return <p className="text-muted">{t("noWarehouses")}</p>;

  const warehouseName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? "";
  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <FormColumns
        aside={
          <FormSummary
            title={tSections("summary")}
            action={
              <Button type="submit" size="xl" loading={busy} iconStart="save">
                {t("submit")}
              </Button>
            }
          >
            <SummaryRows
              rows={[
                ...(KINDS[mode].length ? [{ key: "kind", label: t("kind"), value: t(`kinds.${kind}`) }] : []),
                {
                  key: "from",
                  label: mode === "transfer" ? t("from") : tCommon("warehouse"),
                  value: warehouseName(warehouseId),
                },
                ...(mode === "transfer" ? [{ key: "to", label: t("to"), value: warehouseName(toWarehouseId) }] : []),
                {
                  key: "lines",
                  label: tSections("lines"),
                  value: String(lines.filter((line) => line.itemId).length),
                },
              ]}
            />
          </FormSummary>
        }
      >
        <FormSection card step={1} title={tSections("where")}>
          {KINDS[mode].length ? (
            <div className="flex flex-col gap-2">
              <SegmentedControl
                label={t("kind")}
                size="xl"
                value={kind}
                onValueChange={(next) => setKind(next)}
                options={KINDS[mode].map((value) => ({ value, label: t(`kinds.${value}`) }))}
              />
              {mode === "count" ? (
                <p className="text-muted text-sm">{t(`kindHints.${kind as "count" | "adjustment" | "opening"}`)}</p>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={mode === "transfer" ? t("from") : tCommon("warehouse")}>
              <Select value={warehouseId} onValueChange={setWarehouseId} options={warehouseOptions} />
            </Field>
            {mode === "transfer" ? (
              <Field label={t("to")}>
                <Select
                  value={toWarehouseId}
                  onValueChange={setToWarehouseId}
                  options={warehouseOptions.filter((option) => option.value !== warehouseId)}
                />
              </Field>
            ) : null}
            {mode === "issue" ? (
              <Field label={t("reference")}>
                <Input
                  value={reference}
                  placeholder={t("referencePlaceholder")}
                  onChange={(event) => setReference(event.target.value)}
                />
              </Field>
            ) : null}
          </div>
        </FormSection>
        <FormSection card step={2} title={tSections("lines")}>
          <LinesEditor
            items={items}
            lines={lines}
            onChange={setLines}
            errors={errors}
            locale={locale}
            signed={signed}
            quantityLabel={kind === "count" ? t("countedQty") : kind === "adjustment" ? t("deltaQty") : undefined}
            quantityPlaceholder={kind === "adjustment" ? t("deltaPlaceholder") : undefined}
            {...(kind === "opening" ? { withPrice: t("unitCost", { unit: tCommon("unit") }) } : {})}
          />
          <Field
            label={t("reason")}
            required={kind === "count" || kind === "adjustment"}
            requiredLabel={tCommon("required")}
            error={reasonError}
          >
            <Textarea
              rows={2}
              value={reason}
              placeholder={t("reasonPlaceholder")}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
        </FormSection>
      </FormColumns>
    </form>
  );
}
