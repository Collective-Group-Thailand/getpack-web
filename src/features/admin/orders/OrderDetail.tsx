"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { adminOrderActions } from "@/domain/next-actions/admin";
import { ARTWORK_STATUS, ORDER_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Callout } from "@/ui/components/Callout";
import { PageHeader } from "@/ui/components/PageHeader";
import { Tabs } from "@/ui/components/Tabs";

import { QueryError, StatusChip, useActor } from "../console";
import { useGroupCustomer, useGroupSlips, useOrder, useOrderGroup, type QueuedSlip } from "./data";
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
 * Composed from the published pieces (U-F0.3): the lean order, its group, the customer, and each
 * tab's own resource. What the page aggregate used to carry and the contract does not (next
 * actions, urgency, specs, parts, the tax profile, the order's payments) is marked in each tab.
 */
export function OrderDetail({ orderId, initial, tab }: { orderId: string; initial: Order | null; tab: OrderTab }) {
  const t = useTranslations("orders.detail");
  const format = useFormat();
  const pathname = usePathname();
  const actor = useActor();
  const [current, setCurrent] = useState<string>(tab);
  const [action, setAction] = useState<OrderActionKey | null>(null);
  const [slip, setSlip] = useState<QueuedSlip | null>(null);

  const query = useOrder(orderId, initial);
  const group = useOrderGroup(query.data);
  const customer = useGroupCustomer(group.data?.customerId);
  const slips = useGroupSlips(group.data);

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const order = query.data;
  if (!order) return null;
  const waiting = slips.data ?? [];

  const actions = adminOrderActions(
    { status: order.status, artworkStatus: order.artworkStatus, slipToReview: waiting.length > 0 },
    (permission) => actor.permissions.includes(permission),
  );
  const offered = new Set(actions.filter((item) => !item.blockedBy).map((item) => item.key.slice("order.".length)));
  const open = (key: OrderActionKey, chosen?: QueuedSlip) => {
    setSlip(chosen ?? null);
    setAction(key);
  };
  const customerName = customer.data?.displayName ?? null;

  const tabs = [
    {
      value: "summary",
      label: t("tabs.summary"),
      content: <SummaryTab order={order} group={group.data ?? null} customer={customer.data ?? null} />,
    },
    { value: "items", label: t("tabs.items"), content: <ItemsTab order={order} /> },
    {
      value: "payments",
      label: `${t("tabs.payments")}${waiting.length > 0 ? " •" : ""}`,
      content: (
        <PaymentsTab
          group={group.data ?? null}
          slips={waiting}
          onApproveSlip={offered.has("approve_slip") ? (chosen) => open("approve_slip", chosen) : undefined}
          onRejectSlip={offered.has("reject_slip") ? (chosen) => open("reject_slip", chosen) : undefined}
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
            customer: customerName ?? "—",
            amount: format.thb(order.totals.grossAmount),
            group: group.data?.groupCode ?? "—",
          })}
          actions={<OrderActionBar actions={actions} onAction={(key) => open(key)} />}
        />
      </div>

      {waiting.length > 0 ? <Callout tone="warning" title={t("slipWaiting")} /> : null}
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
        customerName={customerName}
        open={action}
        slip={slip ?? waiting[0] ?? null}
        onClose={() => setAction(null)}
      />
    </div>
  );
}
