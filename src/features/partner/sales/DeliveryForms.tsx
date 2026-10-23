"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { bangkokToday, useRefresh } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { formatQty, isZero, plainNumber, QTY_PATTERN, trimZeros } from "@/features/partner/erp/format";
import { problemMessage } from "@/features/shared/actions";
import { newIdempotencyKey } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { erpPost } from "./api";
import { SalesActions } from "./SalesActions";

type SalesOrder = Schemas["ErpSalesOrderDto"];
type Delivery = Schemas["ErpDeliveryNoteDto"];

/**
 * A delivery note from a confirmed sales order (D-362): what ships now of each line still to deliver, the
 * date, vehicle and note. Saved as a draft; issuing it takes the goods out of stock.
 */
export function DeliveryForm({ order, locale }: { order: SalesOrder; locale: string }) {
  const t = useTranslations("partnerSales.deliveries.form");
  const tCommon = useTranslations("partnerSales.common");
  const tUnits = useTranslations("partnerErp.common.units");
  const { factoryId } = useFactory();
  const router = useRouter();
  const open = order.lines
    .filter((line) => line.fulfilment !== "service")
    .map((line) => ({
      line,
      left: (Number(line.quantity) - Number(line.deliveredQty)).toFixed(3),
    }))
    .filter((row) => Number(row.left) > 0);
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(open.map((row) => [row.line.id, trimZeros(row.left)])),
  );
  const [deliverOn, setDeliverOn] = useState(
    order.deliveryDate && order.deliveryDate > bangkokToday() ? order.deliveryDate : bangkokToday(),
  );
  const [vehicle, setVehicle] = useState("");
  const [shipTo, setShipTo] = useState(order.shipToAddress ?? "");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [key] = useState(newIdempotencyKey);

  if (!open.length) return <p className="text-muted">{t("nothingLeft")}</p>;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    const lines = open
      .map((row) => ({ id: row.line.id, value: plainNumber(qty[row.line.id] ?? "") }))
      .filter((row) => row.value !== "" && !isZero(row.value));
    for (const row of lines) if (!QTY_PATTERN.test(row.value)) next[row.id] = t("qtyInvalid");
    setErrors(next);
    if (Object.keys(next).length) return;
    if (!lines.length) {
      toast.error(t("nothingChosen"));
      return;
    }
    setBusy(true);
    try {
      const created = await erpPost<{ id: string; doNo: string }>(
        factoryId,
        "/delivery-notes",
        {},
        {
          salesOrderId: order.id,
          deliverOn,
          vehicle: vehicle.trim() || null,
          shipToAddress: shipTo.trim() || null,
          note: note.trim() || null,
          lines: lines.map((row) => ({ salesOrderLineId: row.id, quantity: row.value })),
        },
        { idempotencyKey: key },
      );
      toast.success(t("saved", { no: created.doNo }));
      router.push(`/deliveries/${created.id}`);
    } catch (error) {
      toast.error(problemMessage(error, tCommon("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-5" noValidate>
      <ol className="flex flex-col gap-3">
        {open.map(({ line, left }) => (
          <li
            key={line.id}
            className="border-border bg-surface grid gap-3 rounded-xl border p-3 md:grid-cols-[1fr_14rem] md:p-4"
          >
            <div className="flex flex-col">
              <span className="font-medium">{line.description || line.item?.name}</span>
              <span className="text-muted text-sm">
                {t("left", {
                  ordered: formatQty(line.quantity, locale),
                  delivered: formatQty(line.deliveredQty, locale),
                  left: formatQty(left, locale),
                  unit: tUnits(line.unit as never),
                })}
              </span>
            </div>
            <Field label={t("shipNow")} error={errors[line.id]}>
              <NumberInput
                step="any"
                min={0}
                unit={tUnits(line.unit as never)}
                value={qty[line.id] ?? ""}
                onChange={(event) => setQty({ ...qty, [line.id]: event.target.value })}
              />
            </Field>
          </li>
        ))}
      </ol>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("deliverOn")}>
          <Input
            type="date"
            value={deliverOn}
            onChange={(event) => setDeliverOn(event.target.value || bangkokToday())}
          />
        </Field>
        <Field label={t("vehicle")}>
          <Input
            value={vehicle}
            placeholder={t("vehiclePlaceholder")}
            onChange={(event) => setVehicle(event.target.value)}
          />
        </Field>
      </div>
      <Field label={t("shipTo")}>
        <Textarea rows={2} value={shipTo} onChange={(event) => setShipTo(event.target.value)} />
      </Field>
      <Field label={t("note")}>
        <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Button type="submit" size="xl" loading={busy} iconStart="save" className="self-start">
        {t("save")}
      </Button>
    </form>
  );
}

/**
 * What can be done with a delivery note now (D-362): issue it (stock leaves at cost), record that the customer
 * received it, invoice it, cancel it (an issued one returns the stock), print it.
 */
export function DeliveryActions({ delivery, etag }: { delivery: Delivery; etag: string | null }) {
  const t = useTranslations("partnerSales.deliveries.actions");
  const tCommon = useTranslations("partnerSales.common");
  const { factoryId } = useFactory();
  const [refresh] = useRefresh();
  const [open, setOpen] = useState(false);
  const [receivedBy, setReceivedBy] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(newIdempotencyKey);
  const params = { deliveryNoteId: delivery.id };
  const no = delivery.doNo;

  async function deliver() {
    if (receivedBy.trim().length < 2) {
      setError(t("receivedByRequired"));
      return;
    }
    setBusy(true);
    try {
      await erpPost(
        factoryId,
        "/delivery-notes/{deliveryNoteId}/actions/deliver",
        params,
        { receivedBy: receivedBy.trim() },
        { idempotencyKey: key, etag },
      );
      toast.success(t("delivered", { no }));
      setOpen(false);
      refresh();
    } catch (e) {
      toast.error(problemMessage(e, tCommon("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SalesActions
        offered={delivery.nextActions}
        etag={etag}
        actions={[
          {
            key: "erp_do.issue",
            kind: "post",
            primary: true,
            path: "/delivery-notes/{deliveryNoteId}/actions/issue",
            params,
            ifMatch: true,
            title: t("issueTitle", { no }),
            description: t("issueBody", { customer: delivery.customer.name, warehouse: delivery.warehouse.code }),
            done: t("issued", { no }),
          },
          {
            key: "erp_do.deliver",
            kind: "dialog",
            primary: true,
            open: () => {
              setKey(newIdempotencyKey());
              setOpen(true);
            },
          },
          { key: "erp_do.invoice", kind: "link", href: `/invoices/new?do=${delivery.id}` },
          { key: "erp_do.pdf", kind: "pdf", path: "/delivery-notes/{deliveryNoteId}/pdf", params },
          {
            key: "erp_do.cancel",
            kind: "post",
            path: "/delivery-notes/{deliveryNoteId}/actions/cancel",
            params,
            body: (reason) => ({ reason }),
            title: t("cancelTitle"),
            description: delivery.status === "draft" ? t("cancelDraft", { no }) : t("cancelIssued", { no }),
            phrase: no,
            reason: { label: tCommon("reason"), placeholder: tCommon("reasonPlaceholder") },
            done: t("cancelled"),
          },
        ]}
      />
      {open ? (
        <Dialog
          open
          onOpenChange={(next) => !next && setOpen(false)}
          title={t("deliverTitle", { no })}
          description={t("deliverBody", { customer: delivery.customer.name })}
          closeLabel={tCommon("close")}
          footer={
            <Button iconStart="package-check" loading={busy} onClick={() => void deliver()}>
              {t("deliverConfirm")}
            </Button>
          }
        >
          <Field label={t("receivedBy")} error={error} required requiredLabel={tCommon("required")}>
            <Input
              value={receivedBy}
              placeholder={t("receivedByPlaceholder")}
              onChange={(event) => setReceivedBy(event.target.value)}
            />
          </Field>
        </Dialog>
      ) : null}
    </>
  );
}
