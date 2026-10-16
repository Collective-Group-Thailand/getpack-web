"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { CALL_OFF_RELEASE_STATUS, CALL_OFF_STATUS, REORDER_SUGGESTION_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { toast } from "@/ui/components/Toast";

import {
  callOffsList,
  CALL_OFF_STATUSES,
  reorderSuggestionsList,
  SUGGESTION_STATUSES,
  type CallOff,
  type Suggestion,
} from "./resources";
import {
  adminBrowserApis,
  ConfirmAction,
  problemMessage,
  QueueTabs,
  ResourceList,
  SectionNav,
  StatusChip,
  useCan,
  type InitialPage,
} from "../console";

/** Orders and the two queues of repeat business beside them. */
export function OrdersNav() {
  const t = useTranslations("orders.nav");
  return (
    <SectionNav
      label={t("label")}
      items={[
        { href: "/orders", label: t("orders"), exact: true },
        { href: "/orders/reorders", label: t("reorders") },
        { href: "/orders/call-offs", label: t("callOffs") },
      ]}
    />
  );
}

/**
 * Call-off agreements (D-290): a customer locks a quotation option's unit price for a committed
 * quantity, the factory accepts, and each release is a normal order at that price until expiry —
 * what is not released lapses without charge. Buy prices show to those who read them (D-141).
 */
export function CallOffsList({ initial }: { initial: InitialPage<CallOff> | null }) {
  const t = useTranslations("orders.callOffs");
  const tStatus = useTranslations("status");
  const locale = useLocale();
  const format = useFormat();
  const columns: DataTableColumn<CallOff>[] = [
    {
      id: "quote",
      header: t("columns.quote"),
      cell: (row) => (
        <div className="flex flex-col">
          <Link href={`/quotations/${row.quoteId}`} className="text-primary font-mono hover:underline">
            {row.quoteCode ?? t("noCode")}
          </Link>
          <span className="text-muted text-xs">
            {locale === "en" ? row.productType.nameEn : row.productType.nameTh}
          </span>
        </div>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={CALL_OFF_STATUS} value={row.status} />,
    },
    { id: "factory", header: t("columns.factory"), cell: (row) => row.factory?.code ?? "–" },
    {
      id: "quantity",
      header: t("columns.quantity"),
      numeric: true,
      cell: (row) =>
        t("quantities", {
          released: format.number(row.releasedQuantity),
          committed: format.number(row.committedQuantity),
          unit: row.unit,
        }),
    },
    {
      id: "price",
      header: t("columns.price"),
      numeric: true,
      cell: (row) => (
        <div className="flex flex-col items-end">
          <span>{row.unitPrice ? format.thb(row.unitPrice) : "–"}</span>
          {row.buyUnitPrice ? (
            <span className="text-muted text-xs">{t("buy", { price: format.thb(row.buyUnitPrice) })}</span>
          ) : null}
        </div>
      ),
    },
    { id: "expiresAt", header: t("columns.expires"), cell: (row) => <When at={row.expiresAt} absoluteOnly /> },
    {
      id: "releases",
      header: t("columns.releases"),
      cell: (row) =>
        row.releases.length ? (
          <ul className="flex flex-col gap-0.5 text-xs">
            {row.releases.map((release) => (
              <li key={release.id} className="flex flex-wrap items-center gap-1">
                {release.order ? (
                  <Link href={`/orders/${release.order.orderId}`} className="text-primary font-mono hover:underline">
                    {release.order.orderCode}
                  </Link>
                ) : (
                  t("releaseNo", { n: release.seq })
                )}
                <span>{format.number(release.quantity)}</span>
                <StatusChip map={CALL_OFF_RELEASE_STATUS} value={release.status} />
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted text-xs">{t("noReleases")}</span>
        ),
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("statusesLabel")}
        param="status"
        tabs={[
          { value: null, label: t("all") },
          ...CALL_OFF_STATUSES.map((status) => ({ value: status, label: tStatus(CALL_OFF_STATUS[status].labelKey) })),
        ]}
      />
      <ResourceList
        resource={callOffsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        searchPlaceholder={t("searchPlaceholder")}
        empty={{ title: t("empty"), description: t("emptyHint") }}
      />
    </div>
  );
}

/**
 * The reorder suggestion queue (D-288): customers and companies whose repeated orders of one
 * specification suggest they will need it again soon — next need = last order + the average
 * interval, contact date = that less the lead time and the safety days. CS calls, then records what
 * was agreed or sets it aside until the next order of the SKU.
 */
export function ReorderQueue({ initial }: { initial: InitialPage<Suggestion> | null }) {
  const t = useTranslations("orders.reorders");
  const tStatus = useTranslations("status");
  const locale = useLocale();
  const format = useFormat();
  const queryClient = useQueryClient();
  const canWork = useCan("customers.manage");
  const [contacting, setContacting] = useState<Suggestion | null>(null);
  const [dismissing, setDismissing] = useState<Suggestion | null>(null);
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "reorder_suggestion") });
  const who = (row: Suggestion) => row.company?.name ?? row.customer?.displayName ?? "–";

  const columns: DataTableColumn<Suggestion>[] = [
    {
      id: "who",
      header: t("columns.who"),
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{who(row)}</span>
          <span className="text-muted text-xs">
            {locale === "en" ? row.productType.nameEn : row.productType.nameTh}
          </span>
        </div>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={REORDER_SUGGESTION_STATUS} value={row.status} />,
    },
    {
      id: "suggestedOn",
      header: t("columns.suggestedOn"),
      sortable: true,
      cell: (row) => <When at={row.suggestedOn} absoluteOnly />,
    },
    { id: "nextNeedOn", header: t("columns.nextNeed"), cell: (row) => <When at={row.nextNeedOn} absoluteOnly /> },
    {
      id: "quantity",
      header: t("columns.quantity"),
      numeric: true,
      cell: (row) => `${format.number(row.suggestedQuantity)} ${row.lastOrder.unit}`,
    },
    {
      id: "lastOrder",
      header: t("columns.lastOrder"),
      cell: (row) => (
        <div className="flex flex-col text-xs">
          <Link href={`/orders/${row.lastOrder.orderId}`} className="text-primary font-mono hover:underline">
            {row.lastOrder.orderCode}
          </Link>
          <span className="text-muted">
            {t("pattern", {
              orders: row.orderCount,
              days: format.number(Number(row.averageIntervalDays)),
              lead: row.lastLeadTimeDays,
            })}
          </span>
        </div>
      ),
    },
    {
      id: "contact",
      header: t("columns.contact"),
      hideable: true,
      cell: (row) =>
        row.contactedAt ? (
          <div className="flex flex-col text-xs">
            <span>
              {t("contactedBy", { name: row.contactedBy?.displayName ?? "–", at: format.date(row.contactedAt) })}
            </span>
            {row.contactNote ? <span className="text-muted">{row.contactNote}</span> : null}
          </div>
        ) : row.remindedAt ? (
          <span className="text-muted text-xs">{t("reminded", { at: format.date(row.remindedAt) })}</span>
        ) : null,
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      cell: (row) =>
        canWork && row.status !== "dismissed" ? (
          <div className="flex gap-1">
            {row.status === "open" ? (
              <Button size="sm" onClick={() => setContacting(row)}>
                {t("contact")}
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setDismissing(row)}>
              {t("dismiss")}
            </Button>
          </div>
        ) : null,
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("statusesLabel")}
        param="status"
        tabs={[
          { value: null, label: t("openTab") },
          ...SUGGESTION_STATUSES.filter((status) => status !== "open").map((status) => ({
            value: status,
            label: tStatus(REORDER_SUGGESTION_STATUS[status].labelKey),
          })),
        ]}
      />
      <ResourceList
        resource={reorderSuggestionsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        searchPlaceholder={t("searchPlaceholder")}
        filters={[{ id: "dueBy", label: t("dueBy"), kind: "date" }]}
        empty={{ title: t("empty"), description: t("emptyHint") }}
      />
      <ConfirmAction
        open={Boolean(contacting)}
        onOpenChange={(open) => (open ? undefined : setContacting(null))}
        title={t("contactTitle", { who: contacting ? who(contacting) : "" })}
        description={t("contactBody", {
          quantity: contacting ? format.number(contacting.suggestedQuantity) : "",
          date: contacting ? format.date(contacting.nextNeedOn) : "",
        })}
        confirmLabel={t("contact")}
        reason={{ label: t("note"), required: true, minLength: 3, hint: t("noteHint") }}
        onConfirm={async ({ idempotencyKey, reason }) => {
          try {
            await adminBrowserApis().contract.POST(
              "/v1/admin/reorder-suggestions/{suggestionId}/actions/mark-contacted",
              {
                params: { path: { suggestionId: contacting!.id }, header: { "Idempotency-Key": idempotencyKey } },
                body: { note: reason },
              },
            );
            refresh();
            toast.success(t("contacted"));
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
      <ConfirmAction
        open={Boolean(dismissing)}
        onOpenChange={(open) => (open ? undefined : setDismissing(null))}
        title={t("dismissTitle", { who: dismissing ? who(dismissing) : "" })}
        description={t("dismissBody")}
        confirmLabel={t("dismiss")}
        onConfirm={async ({ idempotencyKey }) => {
          try {
            await adminBrowserApis().contract.POST("/v1/admin/reorder-suggestions/{suggestionId}/actions/dismiss", {
              params: { path: { suggestionId: dismissing!.id }, header: { "Idempotency-Key": idempotencyKey } },
            });
            refresh();
            toast.success(t("dismissed"));
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </div>
  );
}
