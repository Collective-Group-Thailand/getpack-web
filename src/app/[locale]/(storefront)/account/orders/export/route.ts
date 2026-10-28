import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { ARTWORK_STATUS, CUSTOMER_ORDER_STATUS, statusMeta } from "@/domain/status";
import { ordersCsv } from "@/features/customer/orders/list/export-csv";
import { productNameOf } from "@/features/customer/orders/summary";
import { bindFormat } from "@/features/shared/format/bind";
import type { Locale } from "@/i18n/routing";
import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

const TABS = ["active", "todo", "in_production", "shipping", "completed", "cancelled"] as const;
const PER_PAGE = 100;
/** At most this many pages are read for one file (10,000 groups). */
const MAX_PAGES = 100;

/**
 * "ส่งออก" of the orders list (account pack Phase 2 item 1): the orders of one tab and search, every page of
 * `store.orders.listGroups?tab=&q=` (D-453), as a CSV file. Signed-in customers only — the API answers for the
 * session's customer; without one the browser goes to sign-in.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (raw === "en" ? "en" : "th") as Locale;
  const search = request.nextUrl.searchParams;
  const tab = TABS.find((candidate) => candidate === search.get("tab")) ?? "active";
  const q = (search.get("q") ?? "").trim().slice(0, 100);
  const groups: Schemas["OrderGroupDto"][] = [];
  try {
    const api = await serverApi("customer");
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { data } = await api.GET("/v1/store/order-groups", {
        params: { query: { tab, page, perPage: PER_PAGE, ...(q ? { q } : {}) } },
      });
      groups.push(...data!.data);
      if (page * PER_PAGE >= data!.meta.total) break;
    }
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      const signIn = new URL(locale === "en" ? "/en/sign-in" : "/sign-in", request.url);
      signIn.searchParams.set("returnTo", "/account/orders");
      return NextResponse.redirect(signIn);
    }
    throw error;
  }
  const [t, tCatalog, tStatus] = await Promise.all([
    getTranslations({ locale, namespace: "myOrders.list.exportColumns" }),
    getTranslations({ locale, namespace: "catalog" }),
    getTranslations({ locale, namespace: "status" }),
  ]);
  // The customer's words for a status, as `StatusChip` shows them in the customer zone.
  const label = (map: Parameters<typeof statusMeta>[0], value: string) => {
    const key = statusMeta(map, value).labelKey;
    return tStatus.has(`customer.${key}`) ? tStatus(`customer.${key}`) : tStatus(key);
  };
  const format = bindFormat(locale);
  const csv = ordersCsv(groups, {
    headers: [
      t("order"),
      t("product"),
      t("quantity"),
      t("unit"),
      t("placed"),
      t("status"),
      t("artwork"),
      t("shipBy"),
      t("total"),
      t("group"),
      t("po"),
    ],
    row: (group, order) => [
      order.orderCode,
      productNameOf(locale, order.summary),
      order.quantityOrdered,
      tCatalog(`stock.units.${order.summary.unit}`),
      format.date(group.placedAt),
      label(CUSTOMER_ORDER_STATUS, order.customerStatus),
      order.artworkOwner !== null ? label(ARTWORK_STATUS, order.artworkStatus) : "",
      order.deliveryDateBasis === "after_payment"
        ? t("afterPayment")
        : order.promisedShipDate
          ? format.date(order.promisedShipDate)
          : "",
      order.totals.grossAmount,
      group.groupCode,
      group.poNumber,
    ],
  });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="getpack-orders-${tab}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
