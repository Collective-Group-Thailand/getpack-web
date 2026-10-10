"use client";

import { useTranslations } from "next-intl";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { useFormat } from "@/features/shared/format/useFormat";
import type { Schemas } from "@/lib/api/types";

import { SalesActions } from "./SalesActions";

type SalesOrder = Schemas["ErpSalesOrderDto"];

/**
 * What can be done with a sales order now (D-361): confirm it — the credit check, stock reserved, production
 * orders for made-to-order lines; past the credit limit only someone who may approve it, with a reason — then
 * deliver and invoice, close what will not ship, cancel, print the order confirmation.
 */
export function SalesOrderActions({ order, etag }: { order: SalesOrder; etag: string | null }) {
  const t = useTranslations("partnerSales.salesOrders.actions");
  const tCommon = useTranslations("partnerSales.common");
  const { can } = useFactory();
  const format = useFormat();
  const params = { salesOrderId: order.id };
  const no = order.soNo;
  const over = order.credit.over;
  return (
    <SalesActions
      offered={order.nextActions}
      etag={etag}
      actions={[
        {
          key: "erp_so.confirm",
          kind: "post",
          primary: true,
          path: "/sales-orders/{salesOrderId}/actions/confirm",
          params,
          ifMatch: true,
          body: (reason) => (over ? { overrideReason: reason } : {}),
          title: t("confirmTitle", { no }),
          description: over
            ? t("confirmOver", {
                limit: format.thb(order.credit.limit ?? "0"),
                receivables: format.thb(order.credit.receivables),
                orders: format.thb(order.credit.openOrders),
              })
            : t("confirmBody", { customer: order.customer.name, total: format.thb(order.total) }),
          ...(over && can("factory_sales.approve")
            ? { reason: { label: t("overrideReason"), placeholder: t("overridePlaceholder") } }
            : {}),
          done: t("confirmed", { no }),
        },
        { key: "erp_so.deliver", kind: "link", primary: true, href: `/deliveries/new?so=${order.id}` },
        { key: "erp_so.invoice", kind: "link", href: `/invoices/new?so=${order.id}` },
        { key: "erp_so.edit", kind: "link", href: `/sales-orders/${order.id}/edit` },
        { key: "erp_so.pdf", kind: "pdf", path: "/sales-orders/{salesOrderId}/pdf", params },
        {
          key: "erp_so.close",
          kind: "post",
          path: "/sales-orders/{salesOrderId}/actions/close",
          params,
          body: (reason) => ({ reason }),
          title: t("closeTitle"),
          description: t("closeBody", { no }),
          reason: { label: tCommon("reason"), placeholder: t("closePlaceholder") },
          done: t("closed"),
        },
        {
          key: "erp_so.cancel",
          kind: "post",
          path: "/sales-orders/{salesOrderId}/actions/cancel",
          params,
          body: (reason) => ({ reason }),
          title: t("cancelTitle"),
          description: t("cancelBody", { no }),
          phrase: no,
          reason: { label: tCommon("reason"), placeholder: tCommon("reasonPlaceholder") },
          done: t("cancelled"),
        },
      ]}
    />
  );
}
