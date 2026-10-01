"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ARTWORK_STATUS, ORDER_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Callout } from "@/ui/components/Callout";
import { PageHeader } from "@/ui/components/PageHeader";
import { Tabs } from "@/ui/components/Tabs";

import { QueryError, StatusChip, useCan } from "../console";
import { useGroupSlips, useOrder, useOrderGroup, type QueuedSlip } from "./data";
import { OrderActionBar, OrderActionDialogs, type OrderActionKey } from "./OrderActions";
import { OrderRail } from "./OrderRail";
import {
  ArtworkTab,
  ClaimsTab,
  DocumentsTab,
  ItemsTab,
  PaymentsTab,
  ProductionTab,
  ShipmentsTab,
  SummaryTab,
} from "./OrderTabs";
import type { Order } from "./resources";
import type { OrderTab } from "./tabs";

/**
 * The order screen (F2 2.2, A.3): a summary header that says what the order is and what happens
 * next, tabs for every side of it, and a rail with the notes and the unified timeline.
 *
 * The header restates code, customer and amount on every tab — the same facts every irreversible
 * action restates — and the tab is in the URL (`?tab=payments`), so a notification or a colleague
 * can link to the exact place.
 *
 * Composed from the published pieces: the lean order with its own `nextActions` (v0.6.0), its
 * group (which names the customer, who placed it, the tax profile and whether a slip waits), and
 * each tab's own resource. What the contract still does not carry (urgency, parts with per-part
 * prices, the factory's name on the order) is marked where it was shown.
 */
export function OrderDetail({ orderId, initial, tab }: { orderId: string; initial: Order | null; tab: OrderTab }) {
  const t = useTranslations("orders.detail");
  const format = useFormat();
  const pathname = usePathname();
  const canReviewSlips = useCan("payments.verify_slip");
  const [current, setCurrent] = useState<string>(tab);
  const [action, setAction] = useState<OrderActionKey | null>(null);
  const [slip, setSlip] = useState<QueuedSlip | null>(null);

  const query = useOrder(orderId, initial);
  const group = useOrderGroup(query.data);
  const slips = useGroupSlips(group.data);

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const order = query.data;
  if (!order) return null;
  const waiting = slips.data ?? [];
  // Every role reading the order learns a slip waits (the group says so); only Finance reviews it,
  // from the slip queue (D-061).
  const slipWaiting = group.data?.hasSlipToReview ?? false;

  const open = (key: OrderActionKey, chosen?: QueuedSlip) => {
    setSlip(chosen ?? null);
    setAction(key);
  };

  const tabs = [
    {
      value: "summary",
      label: t("tabs.summary"),
      content: <SummaryTab order={order} group={group.data ?? null} />,
    },
    { value: "items", label: t("tabs.items"), content: <ItemsTab order={order} /> },
    {
      value: "payments",
      label: `${t("tabs.payments")}${slipWaiting ? " •" : ""}`,
      content: (
        <PaymentsTab
          order={order}
          group={group.data ?? null}
          slips={waiting}
          onApproveSlip={canReviewSlips ? (chosen) => open("approve_slip", chosen) : undefined}
          onRejectSlip={canReviewSlips ? (chosen) => open("reject_slip", chosen) : undefined}
          onRemind={() => open("send_payment_reminder")}
          onRecordSlip={() => open("record_slip")}
        />
      ),
    },
    { value: "artwork", label: t("tabs.artwork"), content: <ArtworkTab order={order} /> },
    { value: "production", label: t("tabs.production"), content: <ProductionTab order={order} /> },
    { value: "shipments", label: t("tabs.shipments"), content: <ShipmentsTab order={order} /> },
    { value: "documents", label: t("tabs.documents"), content: <DocumentsTab order={order} /> },
    { value: "claims", label: t("tabs.claims"), content: <ClaimsTab order={order} /> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-bg z-sticky sticky top-16 -mx-4 border-b border-transparent px-4 pt-1 pb-3 md:-mx-6 md:px-6">
        <PageHeader
          breadcrumbs={
            <Breadcrumbs
              label={t("breadcrumb")}
              items={[{ label: t("orders"), href: "/orders" }, { label: order.orderCode }]}
            />
          }
          title={<span className="font-mono">{order.orderCode}</span>}
          meta={
            <>
              <StatusChip map={ORDER_STATUS} value={order.status} size="md" />
              <StatusChip map={ARTWORK_STATUS} value={order.artworkStatus} size="md" />
            </>
          }
          description={t("headline", {
            customer: group.data?.customer.displayName ?? "—",
            amount: format.thb(order.totals.grossAmount),
            group: group.data?.groupCode ?? "—",
          })}
          actions={<OrderActionBar actions={order.nextActions} onAction={(key) => open(key)} />}
        />
      </div>

      {slipWaiting ? <Callout tone="warning" title={t("slipWaiting")} /> : null}
      {order.internal.belowMarginFloor ? <Callout tone="danger" title={t("belowFloor")} /> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Tabs
          label={t("tabsLabel")}
          items={tabs}
          value={current}
          onValueChange={(next) => {
            setCurrent(next);
            // The URL follows without a server round trip; a shared link still opens this tab.
            window.history.replaceState(null, "", next === "summary" ? pathname : `${pathname}?tab=${next}`);
          }}
        />
        <OrderRail orderId={order.id} />
      </div>

      <OrderActionDialogs
        order={order}
        group={group.data ?? null}
        open={action}
        slip={slip ?? waiting[0] ?? null}
        onClose={() => setAction(null)}
      />
    </div>
  );
}
