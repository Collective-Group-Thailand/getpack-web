"use client";

import { useLocale, useTranslations } from "next-intl";

import { NextStep } from "@/features/customer/shell/NextStep";
import { useFormat } from "@/features/shared/format/useFormat";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { INSTALMENT_STATUS } from "@/domain/status";
import { pick } from "@/features/customer/catalog/localize";
import { Link } from "@/i18n/navigation";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

import { PayInstalmentButton } from "./PayInstalmentButton";

type Instalment = Schemas["StoreInstalmentDto"];

/**
 * The instalment centre (F3 3.3, D-020): every instalment across the customer's orders, when it is
 * due, what is paid and what is left, the orders it pays for, paying the next one
 * (`store.paymentSchedules.listInstalments`). The receipt of a paid one is among its order's
 * documents, linked from the row.
 */
export function InstalmentList({ instalments }: { instalments: Instalment[] }) {
  const t = useTranslations("instalments");
  const format = useFormat();
  const locale = useLocale();

  if (instalments.length === 0) {
    return (
      <EmptyState
        className="mt-8"
        icon="wallet"
        title={t("emptyTitle")}
        description={t("emptyBody")}
        action={<NextStep to="orders" />}
      />
    );
  }

  return (
    <div className="bg-surface border-border mt-6 overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <caption className="sr-only">{t("caption")}</caption>
        <thead className="bg-bg-subtle text-muted text-xs">
          <tr>
            <th scope="col" className="px-4 py-2 text-start font-medium">
              {t("order")}
            </th>
            <th scope="col" className="px-4 py-2 text-start font-medium">
              {t("instalment")}
            </th>
            <th scope="col" className="px-4 py-2 text-end font-medium">
              {t("amount")}
            </th>
            <th scope="col" className="px-4 py-2 text-start font-medium">
              {t("status")}
            </th>
            <th scope="col" className="px-4 py-2 text-end font-medium">
              <span className="sr-only">{t("actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {instalments.map((instalment) => {
            const order = instalment.orders[0];
            const label = pick(locale, instalment.labelTh, instalment.labelEn);
            const code = order?.orderCode ?? instalment.groupCode;
            return (
              <tr key={instalment.id} className="border-border border-t">
                <th scope="row" className="px-4 py-3 text-start font-medium">
                  {instalment.orders.map((ref) => (
                    <Link
                      key={ref.orderId}
                      href={`/account/orders/${ref.orderId}`}
                      className="text-primary block underline-offset-4 hover:underline"
                    >
                      {ref.orderCode}
                    </Link>
                  ))}
                  <span className="text-muted block text-xs font-normal">{instalment.groupCode}</span>
                </th>
                <td className="px-4 py-3">
                  {label}
                  <span className="text-muted block text-xs">
                    {instalment.dueAt
                      ? t("dueBy", { date: format.date(instalment.dueAt) })
                      : t(`trigger.${instalment.dueTrigger}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-end tabular-nums">
                  {format.thb(instalment.grossAmount)}
                  {instalment.status === "partially_paid" ? (
                    <span className="text-muted block text-xs">
                      {t("open", { amount: format.thb(instalment.openAmount) })}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <StatusChip map={INSTALMENT_STATUS} value={instalment.status} />
                </td>
                <td className="px-4 py-3 text-end">
                  {instalment.payable ? (
                    <PayInstalmentButton
                      size="sm"
                      instalment={{
                        id: instalment.id,
                        groupId: instalment.groupId,
                        label,
                        grossAmount: instalment.openAmount,
                        activePaymentId: instalment.activePaymentId,
                      }}
                      orderCode={code}
                    >
                      {instalment.activePaymentId ? t("continue") : t("pay")}
                      <span className="sr-only">
                        {" "}
                        {code} {label}
                      </span>
                    </PayInstalmentButton>
                  ) : instalment.status === "paid" && order ? (
                    <Button size="sm" variant="ghost" asChild iconStart="file-check">
                      <Link href={`/account/orders/${order.orderId}#order-documents`}>
                        {t("receipt")}
                        <span className="sr-only">
                          {" "}
                          {code} {label}
                        </span>
                      </Link>
                    </Button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
