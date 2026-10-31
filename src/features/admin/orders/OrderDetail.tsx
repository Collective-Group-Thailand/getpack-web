"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ARTWORK_STATUS, ORDER_STATUS, statusMeta } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { Callout } from "@/ui/components/Callout";
import { ActionPanel } from "@/ui/components/DetailLayout";
import { PageHeader } from "@/ui/components/PageHeader";
import { Tabs } from "@/ui/components/Tabs";

import { QueryError, StatusChip, useCan } from "../console";
import { useGroupSlips, useOrder, useOrderGroup, type QueuedSlip } from "./data";
import { OrderActionBar, OrderActionDialogs, type OrderActionKey } from "./OrderActions";
import { ClaimOpenRow, OrderProgress, SpecSheetCard } from "./OrderExtras";
import { OrderHistory, OrderRail } from "./OrderRail";
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
  const tActions = useTranslations("console.actions");
  const tStatus = useTranslations("status");
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
    {
      value: "production",
      label: t("tabs.production"),
      content: (
        <div className="flex flex-col gap-4">
          <OrderProgress order={order} />
          <ProductionTab order={order} />
        </div>
      ),
    },
    { value: "shipments", label: t("tabs.shipments"), content: <ShipmentsTab order={order} /> },
    {
      value: "documents",
      label: t("tabs.documents"),
      content: (
        <div className="flex flex-col gap-4">
          <SpecSheetCard order={order} />
          <DocumentsTab order={order} />
        </div>
      ),
    },
    {
      value: "claims",
      label: t("tabs.claims"),
      content: (
        <div className="flex flex-col gap-4">
          <ClaimOpenRow order={order} />
          <ClaimsTab order={order} />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back={{ href: "/orders", label: t("orders") }}
        title={<span className="tabular-nums">{order.orderCode}</span>}
        meta={
          <span
            className="flex items-center"
            title={`${t("artworkLabel")}: ${tStatus(statusMeta(ARTWORK_STATUS, order.artworkStatus).labelKey)}`}
          >
            <StatusChip map={ORDER_STATUS} value={order.status} size="md" />
          </span>
        }
        description={t("headline", {
          customer: group.data?.customer.displayName ?? "—",
          amount: format.thb(order.totals.grossAmount),
          group: group.data?.groupCode ?? "—",
        })}
      />

      {slipWaiting ? <Callout tone="warning" title={t("slipWaiting")} /> : null}
      {order.internal.belowMarginFloor ? <Callout tone="danger" title={t("belowFloor")} /> : null}

      {/* The tabs, and beside them the next step with where the order stands — first on a phone, before the long
          cards — then the timeline and notes (under the tabs on a phone). */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
        <aside className="flex min-w-0 flex-col gap-4 xl:col-start-2 xl:row-start-1">
          <ActionPanel
            id="order-next"
            tone={order.nextActions.length > 0 ? "primary" : "neutral"}
            title={tActions("nextTitle")}
            description={order.nextActions.length > 0 ? undefined : tActions("nothingNext")}
          >
            <OrderActionBar layout="panel" actions={order.nextActions} onAction={(key) => open(key)} />
          </ActionPanel>
          <OrderRail order={order} />
        </aside>
        <div className="min-w-0 xl:col-start-1 xl:row-span-2 xl:row-start-1">
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
        </div>
        <div className="flex min-w-0 flex-col gap-4 xl:col-start-2 xl:row-start-2">
          <OrderHistory order={order} />
        </div>
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
