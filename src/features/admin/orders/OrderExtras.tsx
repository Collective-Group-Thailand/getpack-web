"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { MILESTONE_STATUS } from "@/domain/status";
import { uploadFile } from "@/features/shared/files/upload";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { useFormat } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import type { ComboboxOption } from "@/ui/components/Combobox";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { NumberInput, Textarea } from "@/ui/components/Input";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";

import { RecordPicker } from "../agents/Pickers";
import {
  adminBrowserApis,
  ConfirmAction,
  download,
  FormDialog,
  FormError,
  problemMessage,
  QueryError,
  StatusChip,
  useCan,
} from "../console";
import type { Order, OrderGroup } from "./resources";

type ClaimType = Schemas["ClaimType"];
type Resolution = Schemas["ClaimResolutionKind"];

const CLAIM_TYPES = [
  "damaged",
  "wrong_spec",
  "print_defect",
  "quantity_short",
  "late",
  "other",
] as const satisfies readonly ClaimType[];
const RESOLUTIONS = [
  "reprint",
  "partial_refund",
  "full_refund",
  "credit",
  "goodwill",
] as const satisfies readonly Resolution[];

/** Re-reads the order, its group and the lists that show them after a write. */
function useSettleOrder() {
  const queryClient = useQueryClient();
  return () => {
    for (const resource of ["order", "order_group", "claim", "quote"]) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", resource) });
    }
  };
}

/**
 * Promised vs actual (D-075, D-081): the ship date promised at checkout against what happened —
 * artwork approved, paid for production, started, shipped, delivered — and the steps the customer
 * sees with their own promised times.
 */
export function OrderProgress({ order }: { order: Order }) {
  const t = useTranslations("orders.progress");
  const locale = useLocale();
  const format = useFormat();
  const progress = useQuery({
    queryKey: queryKeys.related("admin", "order", order.id, "progress"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/orders/{orderId}/progress", {
          params: { path: { orderId: order.id } },
        })
      ).data!,
  });
  if (progress.isError) return <QueryError error={progress.error} onRetry={() => void progress.refetch()} />;
  const data = progress.data;
  if (!data) return <Skeleton className="h-32" />;
  const facts = [
    ["artworkApprovedAt", data.artworkApprovedAt],
    ["paidForProductionAt", data.paidForProductionAt],
    ["productionStartedAt", data.productionStartedAt],
    ["shippedAt", data.shippedAt],
    ["deliveredAt", data.deliveredAt],
    ["completedAt", data.completedAt],
  ] as const;
  return (
    <Card padding="lg">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{t("title")}</CardTitle>
        {data.shippedOnTime === null ? null : data.shippedOnTime ? (
          <Badge tone="success" icon="check">
            {t("onTime")}
          </Badge>
        ) : (
          <Badge tone="danger" icon="clock">
            {t("late")}
          </Badge>
        )}
      </CardHeader>
      <p className="text-sm">
        {data.promisedShipDate ? t("promised", { date: format.date(data.promisedShipDate) }) : t("noPromise")}
        {data.estimatedDeliveryDate
          ? ` · ${t("estimatedDelivery", { date: format.date(data.estimatedDeliveryDate) })}`
          : ""}
      </p>
      <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        {facts.map(([key, at]) => (
          <li key={key} className="flex flex-col">
            <span className="text-muted text-xs">{t(`facts.${key}`)}</span>
            <span className={at ? "" : "text-muted"}>{at ? format.dateTime(at) : t("notYet")}</span>
          </li>
        ))}
      </ul>
      {data.steps.length ? (
        <ol className="border-border mt-4 flex flex-col gap-2 border-t pt-3 text-sm">
          {data.steps.map((step) => (
            <li key={step.key} className="flex flex-wrap items-center justify-between gap-2">
              <span>{locale === "en" ? step.labelEn : step.labelTh}</span>
              <span className="text-muted text-xs">
                {step.completedAt
                  ? t("done", { at: format.dateTime(step.completedAt) })
                  : step.promisedAt
                    ? t("due", { at: format.dateTime(step.promisedAt) })
                    : null}
              </span>
              <StatusChip map={MILESTONE_STATUS} value={step.status} />
            </li>
          ))}
        </ol>
      ) : null}
    </Card>
  );
}

/** The packaging spec sheet (D-287), in Thai or English, once the artwork or sample is approved. */
export function SpecSheetCard({ order }: { order: Order }) {
  const t = useTranslations("orders.specSheet");
  const [busy, setBusy] = useState<"th" | "en" | null>(null);
  const fetchSheet = async (lang: "th" | "en") => {
    setBusy(lang);
    try {
      const { data } = await adminBrowserApis().contract.GET("/v1/admin/orders/{orderId}/spec-sheet", {
        params: { path: { orderId: order.id }, query: { lang } },
      });
      download(data!.url);
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(null);
    }
  };
  const ready = order.artworkStatus === "approved";
  return (
    <Card padding="lg">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{t("title")}</CardTitle>
        <div className="flex gap-2">
          {(["th", "en"] as const).map((lang) => (
            <Button
              key={lang}
              size="sm"
              variant="secondary"
              iconStart="download"
              loading={busy === lang}
              onClick={() => void fetchSheet(lang)}
            >
              {t(`download.${lang}`)}
            </Button>
          ))}
        </div>
      </CardHeader>
      <p className="text-muted text-sm">{ready ? t("body") : t("notReady")}</p>
    </Card>
  );
}

/** A claim the customer made by phone or LINE (D-082, D-083): staff record it, not bound by the window. */
export function OpenClaimButton({ order }: { order: Order }) {
  const t = useTranslations("orders.openClaim");
  const canManage = useCan("claims.manage");
  const [open, setOpen] = useState(false);
  if (!canManage) return null;
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        iconStart="flag"
        // A claim is about goods received (`claims.not_delivered`): until delivery there is nothing to claim.
        disabled={!order.receipt.deliveredAt}
        title={order.receipt.deliveredAt ? undefined : t("notDelivered")}
        onClick={() => setOpen(true)}
      >
        {t("open")}
      </Button>
      {open ? <OpenClaimDialog order={order} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function OpenClaimDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const t = useTranslations("orders.openClaim");
  const tTypes = useTranslations("orders.openClaim.types");
  const settle = useSettleOrder();
  const [type, setType] = useState<ClaimType>("damaged");
  const [resolution, setResolution] = useState<Resolution>("reprint");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [amount, setAmount] = useState("");
  const [shipmentId, setShipmentId] = useState("none");
  const [productPhotos, setProductPhotos] = useState<File[]>([]);
  const [cartonPhotos, setCartonPhotos] = useState<File[]>([]);
  // One key for this claim: a retry after a timeout cannot open it twice.
  const [idempotencyKey] = useState(newIdempotencyKey);
  const canShipments = useCan("shipments.read");
  const shipments = useQuery({
    enabled: canShipments,
    queryKey: queryKeys.list("admin", "shipment", { orderId: order.id }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/shipments", {
          params: { query: { orderId: order.id, perPage: 50 } },
        })
      ).data!,
  });
  const dropLabels = (chosen: File[]) => ({
    prompt: chosen.length ? t("photosChosen", { count: chosen.length }) : t("drop"),
    browse: t("browse"),
    tooLarge: (name: string) => t("tooLarge", { name }),
    wrongType: (name: string) => t("wrongType", { name }),
  });
  return (
    <FormDialog
      size="lg"
      title={t("title", { code: order.orderCode })}
      description={t("body")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (description.trim().length < 5) throw new FormError(t("needDescription"));
        if (quantity && !/^\d+$/.test(quantity)) throw new FormError(t("badQuantity"));
        if (amount && !/^\d+(\.\d{1,2})?$/.test(amount)) throw new FormError(t("badAmount"));
        const upload = (files: File[]) => Promise.all(files.map((file) => uploadFile("admin", file, "evidence")));
        const [product, carton] = await Promise.all([upload(productPhotos), upload(cartonPhotos)]);
        const { data } = await adminBrowserApis().contract.POST("/v1/admin/orders/{orderId}/claims", {
          params: { path: { orderId: order.id }, header: { "Idempotency-Key": idempotencyKey } },
          body: {
            type,
            requestedResolution: resolution,
            description: description.trim(),
            ...(quantity ? { claimedQuantity: Number(quantity) } : {}),
            ...(amount ? { claimedAmount: Number(amount).toFixed(2) } : {}),
            ...(shipmentId !== "none" ? { shipmentId } : {}),
            ...(product.length ? { productPhotoFileIds: product.map((file) => file.id) } : {}),
            ...(carton.length ? { cartonPhotoFileIds: carton.map((file) => file.id) } : {}),
          },
        });
        settle();
        toast.success(t("done", { no: data!.claimNo }));
        onClose();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("type")} required>
          <SearchableSelect
            value={type}
            onValueChange={(value) => setType(value as ClaimType)}
            options={CLAIM_TYPES.map((value) => ({ value, label: tTypes(value) }))}
          />
        </Field>
        <Field label={t("resolution")} required>
          <SearchableSelect
            value={resolution}
            onValueChange={(value) => setResolution(value as Resolution)}
            options={RESOLUTIONS.map((value) => ({ value, label: t(`resolutions.${value}`) }))}
          />
        </Field>
        <Field label={t("quantity")} hint={t("quantityHint")}>
          <NumberInput min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        </Field>
        <Field label={t("amount")} hint={t("amountHint")}>
          <NumberInput
            unit={t("baht")}
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
      </div>
      {shipments.data?.data.length ? (
        <Field label={t("shipment")}>
          <SearchableSelect
            value={shipmentId}
            onValueChange={setShipmentId}
            options={[
              { value: "none", label: t("anyShipment") },
              ...shipments.data.data.map((shipment) => ({ value: shipment.id, label: shipment.shipmentNo })),
            ]}
          />
        </Field>
      ) : null}
      <Field label={t("description")} hint={t("descriptionHint")} required>
        <Textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("productPhotos")}</span>
          <FileDropzone
            accept="image/*"
            multiple
            maxBytes={20 * 1024 * 1024}
            onFiles={setProductPhotos}
            labels={dropLabels(productPhotos)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("cartonPhotos")}</span>
          <FileDropzone
            accept="image/*"
            multiple
            maxBytes={20 * 1024 * 1024}
            onFiles={setCartonPhotos}
            labels={dropLabels(cartonPhotos)}
          />
        </div>
      </div>
    </FormDialog>
  );
}

/**
 * Edit & re-price an order before production (D-051, D-073): CS saves the change as a live quotation
 * of the same customer and product type, then the order takes that quotation's option; shipping is
 * re-priced per destination and the previous pricing is kept as a revision.
 */
export function RepriceOrderDialog({
  order,
  group,
  onClose,
}: {
  order: Order;
  group: OrderGroup | null;
  onClose: () => void;
}) {
  const t = useTranslations("orders.reprice");
  const format = useFormat();
  const settle = useSettleOrder();
  const customerId = group?.customer.id;
  const [quoteId, setQuoteId] = useState("");
  const [optionId, setOptionId] = useState("");
  const [reason, setReason] = useState("");
  const quotes = useQuery({
    enabled: Boolean(customerId),
    queryKey: queryKeys.list("admin", "quote", { customerId, perPage: 50 }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/quotes", { params: { query: { customerId, perPage: 50 } } }))
        .data!,
  });
  const live = (quotes.data?.data ?? []).filter(
    (quote) =>
      quote.productTypeCode === order.productTypeCode &&
      ["saved", "shared"].includes(quote.status) &&
      quote.id !== order.quoteId,
  );
  const quote = live.find((candidate) => candidate.id === quoteId);
  return (
    <FormDialog
      title={t("title", { code: order.orderCode })}
      description={t("body", { amount: format.thb(order.totals.grossAmount) })}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (!quote || !optionId) throw new FormError(t("needQuote"));
        if (reason.trim().length < 3) throw new FormError(t("needReason"));
        const { contract } = adminBrowserApis();
        // The order's current ETag: the API refuses a change made over someone else's.
        const { response } = await contract.GET("/v1/admin/orders/{orderId}", {
          params: { path: { orderId: order.id } },
        });
        await contract.POST("/v1/admin/orders/{orderId}/actions/reprice", {
          params: { path: { orderId: order.id }, header: { "If-Match": response.headers.get("ETag") ?? "" } },
          body: { quoteId: quote.id, quoteOptionId: optionId, reason: reason.trim() },
        });
        settle();
        toast.success(t("done"));
        onClose();
      }}
    >
      {!customerId ? <Callout tone="warning" title={t("noCustomer")} /> : null}
      {quotes.isPending && customerId ? <Skeleton className="h-10" /> : null}
      {quotes.data && live.length === 0 ? (
        <Callout tone="info" title={t("noQuotes")}>
          {t("noQuotesBody")}
        </Callout>
      ) : null}
      {live.length ? (
        <>
          <Field label={t("quote")} required>
            <SearchableSelect
              value={quoteId || undefined}
              placeholder={t("choose")}
              onValueChange={(value) => {
                setQuoteId(value);
                setOptionId(live.find((candidate) => candidate.id === value)?.options[0]?.id ?? "");
              }}
              options={live.map((candidate) => ({
                value: candidate.id,
                label: `${candidate.quoteCode ?? t("noCode")} · ${format.date(candidate.createdAt)}`,
              }))}
            />
          </Field>
          {quote ? (
            <Field label={t("option")} required>
              <SearchableSelect
                value={optionId || undefined}
                onValueChange={setOptionId}
                options={quote.options.map((option) => ({
                  value: option.id,
                  label: t("optionLabel", {
                    quantity: format.number(option.quantity),
                    amount: format.thb(option.grossAmount),
                  }),
                }))}
              />
            </Field>
          ) : null}
        </>
      ) : null}
      <Field label={t("reason")} hint={t("reasonHint")} required>
        <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </FormDialog>
  );
}

type GroupAction = "cancel" | "change_customer" | "schedule";

/**
 * The order group's own operations (D-020, D-060, D-142): cancel every order not yet in production,
 * move an unpaid group to another customer, or replace its payment schedule with another template in
 * force. Each restates the group and its total; the API refuses what no longer applies.
 */
export function GroupActions({ group }: { group: OrderGroup }) {
  const t = useTranslations("orders.groupActions");
  const locale = useLocale();
  const format = useFormat();
  const settle = useSettleOrder();
  const canCancel = useCan("orders.cancel");
  const canMove = useCan("orders.manage");
  const canOverride = useCan("payment_schedules.override");
  const [open, setOpen] = useState<GroupAction | null>(null);
  const [reasonCode, setReasonCode] = useState("");
  const [customer, setCustomer] = useState<ComboboxOption | null>(null);
  const [templateKey, setTemplateKey] = useState("");
  const restated = t("restate", {
    code: group.groupCode,
    amount: format.thb(group.totals.grossAmount),
    customer: group.customer.displayName,
  });
  const reasons = useQuery({
    enabled: open === "cancel",
    queryKey: queryKeys.list("admin", "order_cancel_reason", { appliesTo: "staff" }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/order-cancel-reasons", {
          params: { query: { appliesTo: "staff" } },
        })
      ).data!,
  });
  const templates = useQuery({
    enabled: open === "schedule",
    queryKey: queryKeys.list("admin", "payment_schedule_template"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/payment-schedule-templates")).data!,
  });
  if (group.status === "cancelled" || !(canCancel || canMove || canOverride)) return null;
  const fail = (error: unknown): never => {
    toast.error(problemMessage(error, t("failed")));
    throw error;
  };
  const close = (next: boolean) => (next ? undefined : setOpen(null));
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canOverride ? (
          <Button size="sm" variant="secondary" iconStart="calendar" onClick={() => setOpen("schedule")}>
            {t("schedule.open")}
          </Button>
        ) : null}
        {canMove ? (
          <Button size="sm" variant="secondary" iconStart="user" onClick={() => setOpen("change_customer")}>
            {t("move.open")}
          </Button>
        ) : null}
        {canCancel ? (
          <Button size="sm" variant="ghost" iconStart="ban" onClick={() => setOpen("cancel")}>
            {t("cancel.open")}
          </Button>
        ) : null}
      </div>
      <ConfirmAction
        open={open === "cancel"}
        onOpenChange={close}
        title={t("cancel.title")}
        description={`${restated} ${t("cancel.body")}`}
        confirmLabel={t("cancel.confirm")}
        tone="destructive"
        confirmationPhrase={group.groupCode}
        reason={{ label: t("cancel.note") }}
        onConfirm={async ({ reason }) => {
          if (!reasonCode) {
            toast.error(t("cancel.chooseReason"));
            throw new Error("no reason");
          }
          try {
            const { contract } = adminBrowserApis();
            const { response } = await contract.GET("/v1/admin/order-groups/{groupId}", {
              params: { path: { groupId: group.id } },
            });
            await contract.POST("/v1/admin/order-groups/{groupId}/actions/cancel", {
              params: { path: { groupId: group.id }, header: { "If-Match": response.headers.get("ETag") ?? "" } },
              body: { reasonCode, ...(reason ? { note: reason } : {}) },
            });
            settle();
            toast.success(t("cancel.done"));
          } catch (error) {
            fail(error);
          }
        }}
      >
        <Field label={t("cancel.reasonCode")} required className="mt-4">
          <SearchableSelect
            value={reasonCode || undefined}
            onValueChange={setReasonCode}
            placeholder={t("cancel.chooseReason")}
            options={(reasons.data ?? []).map((reason) => ({
              value: reason.code,
              label: locale === "en" ? reason.nameEn : reason.nameTh,
            }))}
          />
        </Field>
      </ConfirmAction>
      <ConfirmAction
        open={open === "change_customer"}
        onOpenChange={close}
        title={t("move.title")}
        description={`${restated} ${t("move.body")}`}
        confirmLabel={t("move.confirm")}
        confirmationPhrase={group.groupCode}
        onConfirm={async () => {
          if (!customer) {
            toast.error(t("move.choose"));
            throw new Error("no customer");
          }
          try {
            const { contract } = adminBrowserApis();
            const { response } = await contract.GET("/v1/admin/order-groups/{groupId}", {
              params: { path: { groupId: group.id } },
            });
            await contract.POST("/v1/admin/order-groups/{groupId}/actions/change-customer", {
              params: { path: { groupId: group.id }, header: { "If-Match": response.headers.get("ETag") ?? "" } },
              body: { customerId: customer.value },
            });
            settle();
            toast.success(t("move.done", { customer: customer.label }));
          } catch (error) {
            fail(error);
          }
        }}
      >
        <Field label={t("move.customer")} required className="mt-4">
          <RecordPicker kind="customer" value={customer} onValueChange={setCustomer} aria-label={t("move.customer")} />
        </Field>
      </ConfirmAction>
      <ConfirmAction
        open={open === "schedule"}
        onOpenChange={close}
        title={t("schedule.title")}
        description={`${restated} ${t("schedule.body")}`}
        confirmLabel={t("schedule.confirm")}
        reason={{ label: t("schedule.reason"), required: true, minLength: 3 }}
        onConfirm={async ({ reason }) => {
          if (!templateKey) {
            toast.error(t("schedule.choose"));
            throw new Error("no template");
          }
          try {
            const { contract } = adminBrowserApis();
            const { response } = await contract.GET("/v1/admin/order-groups/{groupId}/payment-schedule", {
              params: { path: { groupId: group.id } },
            });
            await contract.POST("/v1/admin/order-groups/{groupId}/payment-schedule/actions/override", {
              params: { path: { groupId: group.id }, header: { "If-Match": response.headers.get("ETag") ?? "" } },
              body: { templateKey, reason },
            });
            settle();
            toast.success(t("schedule.done"));
          } catch (error) {
            fail(error);
          }
        }}
      >
        <Field label={t("schedule.template")} required className="mt-4">
          <SearchableSelect
            value={templateKey || undefined}
            onValueChange={setTemplateKey}
            placeholder={t("schedule.choose")}
            options={(templates.data ?? [])
              .filter((template) => template.versionNo !== null)
              .map((template) => ({
                value: template.key,
                label: `${locale === "en" ? template.nameEn : template.nameTh} · ${template.instalments
                  .map((instalment) => format.percent(instalment.pct))
                  .join(" / ")}`,
              }))}
          />
        </Field>
      </ConfirmAction>
    </>
  );
}

/** Shown where a claim can be opened, with no claims yet: keeps the button where staff look for it. */
export function ClaimOpenRow({ order }: { order: Order }) {
  const t = useTranslations("orders.openClaim");
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-muted text-sm">{t("hint")}</p>
      <OpenClaimButton order={order} />
    </div>
  );
}
