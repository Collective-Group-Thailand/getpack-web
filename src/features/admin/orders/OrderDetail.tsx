"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ARTWORK_STATUS, INSTALMENT_STATUS, ORDER_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { STALE_TIME } from "@/lib/query/defaults";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Callout } from "@/ui/components/Callout";
import { PageHeader } from "@/ui/components/PageHeader";
import { Tabs } from "@/ui/components/Tabs";

import { QueryError, StatusChip } from "../console";
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

type Slip = Order["payments"][number]["slips"][number];

/**
 * The order screen (F2 2.2, A.3): a summary header that says what the order is and what happens
 * next, tabs for every side of it, and a rail with the notes and the unified timeline.
 *
 * The header restates code, customer and amount on every tab — the same facts every irreversible
 * action restates — and the tab is in the URL (`?tab=payments`), so a notification or a colleague
 * can link to the exact place.
 */
export function OrderDetail({ orderId, initial, tab }: { orderId: string; initial: Order | null; tab: OrderTab }) {
  const t = useTranslations("orders.detail");
  const format = useFormat();
  const pathname = usePathname();
  const [current, setCurrent] = useState<string>(tab);
  const [action, setAction] = useState<OrderActionKey | null>(null);
  const [slip, setSlip] = useState<Slip | null>(null);

  const query = useQuery({
    queryKey: queryKeys.detail("admin", "order", orderId),
    queryFn: () => browserRequests().call("GET /v1/admin/orders/{orderId}", { path: { orderId } }),
    initialData: initial ?? undefined,
    staleTime: STALE_TIME.transactional,
  });

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const order = query.data;
  if (!order) return null;

  const offered = new Set(
    order.nextActions
      .filter((item) => !item.disabledReason)
      .map((item) => item.key.slice(item.key.lastIndexOf(".") + 1)),
  );
  const open = (key: OrderActionKey, chosen?: Slip) => {
    setSlip(chosen ?? null);
    setAction(key);
  };

  const count = (n: number) => (n > 0 ? ` (${n})` : "");
  const tabs = [
    { value: "summary", label: t("tabs.summary"), content: <SummaryTab order={order} /> },
    { value: "items", label: t("tabs.items"), content: <ItemsTab order={order} /> },
    {
      value: "payments",
      label: `${t("tabs.payments")}${order.hasSlipToReview ? " •" : ""}`,
      content: (
        <PaymentsTab
          order={order}
          onApproveSlip={offered.has("approve_slip") ? (chosen) => open("approve_slip", chosen) : undefined}
          onRejectSlip={offered.has("reject_slip") ? (chosen) => open("reject_slip", chosen) : undefined}
        />
      ),
    },
    { value: "artwork", label: t("tabs.artwork"), content: <ArtworkTab order={order} /> },
    { value: "production", label: t("tabs.production"), content: <ProductionTab order={order} /> },
    {
      value: "shipments",
      label: `${t("tabs.shipments")}${count(order.shipments.length)}`,
      content: <ShipmentsTab order={order} />,
    },
    {
      value: "documents",
      label: `${t("tabs.documents")}${count(order.documents.length)}`,
      content: <DocumentsTab order={order} />,
    },
    {
      value: "claims",
      label: `${t("tabs.claims")}${count(order.claims.length)}`,
      content: <ClaimsTab order={order} />,
    },
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
              {order.nextInstalment ? (
                <StatusChip map={INSTALMENT_STATUS} value={order.nextInstalment.status} size="md" />
              ) : null}
              {order.urgency !== "normal" ? (
                <Badge tone={order.urgency === "late" ? "danger" : "warning"} icon="warning">
                  {t(`urgency.${order.urgency}`)}
                </Badge>
              ) : null}
            </>
          }
          description={t("headline", {
            customer: order.customer.displayName,
            amount: format.thb(order.grossAmount),
            group: order.group.groupCode,
          })}
          actions={<OrderActionBar order={order} onAction={(key) => open(key)} />}
        />
      </div>

      {order.hasSlipToReview ? <Callout tone="warning" title={t("slipWaiting")} /> : null}
      {order.margin?.belowMarginFloor ? <Callout tone="danger" title={t("belowFloor")} /> : null}

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

      <OrderActionDialogs order={order} open={action} slip={slip} onClose={() => setAction(null)} />
    </div>
  );
}
