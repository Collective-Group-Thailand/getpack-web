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

  // What a row offers — paying the open amount, or the receipt of a paid one — once for the table and the
  // phone's cards.
  const actionOf = (instalment: Instalment, block = false) => {
    const order = instalment.orders[0];
    const label = pick(locale, instalment.labelTh, instalment.labelEn);
    const code = order?.orderCode ?? instalment.groupCode;
    if (instalment.payable)
      return (
        <PayInstalmentButton
          size="sm"
          className={block ? "w-full" : undefined}
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
      );
    if (instalment.status === "paid" && order)
      return (
        <Button
          size="sm"
          variant={block ? "secondary" : "ghost"}
          asChild
          iconStart="file-check"
          className={block ? "w-full" : undefined}
        >
          <Link href={`/account/orders/${order.orderId}#order-documents`}>
            {t("receipt")}
            <span className="sr-only">
              {" "}
              {code} {label}
            </span>
          </Link>
        </Button>
      );
    return null;
  };
  const dueOf = (instalment: Instalment) =>
    instalment.dueAt ? t("dueBy", { date: format.date(instalment.dueAt) }) : t(`trigger.${instalment.dueTrigger}`);

  return (
    <>
      {/* Project B2: below md each instalment is a card — orders and status, the instalment and when it falls
        due, the amount, and its one action full width. */}
      <ul className="mt-6 flex flex-col gap-3 md:hidden" aria-label={t("caption")}>
        {instalments.map((instalment) => {
          const action = actionOf(instalment, true);
          return (
            <li key={instalment.id} className="bg-surface border-border rounded-card flex flex-col gap-3 border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-sm font-medium">
                  {instalment.orders.map((ref) => (
                    <Link
                      key={ref.orderId}
                      href={`/account/orders/${ref.orderId}`}
                      className="text-primary block tabular-nums underline-offset-4 hover:underline"
                    >
                      {ref.orderCode}
                    </Link>
                  ))}
                  <span className="text-muted block text-xs font-normal tabular-nums">{instalment.groupCode}</span>
                </div>
                <StatusChip map={INSTALMENT_STATUS} value={instalment.status} />
              </div>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{pick(locale, instalment.labelTh, instalment.labelEn)}</p>
                  <p className="text-muted text-xs">{dueOf(instalment)}</p>
                </div>
                <div className="shrink-0 text-end tabular-nums">
                  <p className="text-lg font-semibold">{format.thb(instalment.grossAmount)}</p>
                  {instalment.status === "partially_paid" ? (
                    <p className="text-muted text-xs">{t("open", { amount: format.thb(instalment.openAmount) })}</p>
                  ) : null}
                </div>
              </div>
              {action}
            </li>
          );
        })}
      </ul>
      <div className="bg-surface border-border relative mt-6 hidden overflow-x-auto rounded-xl border md:block">
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
              const label = pick(locale, instalment.labelTh, instalment.labelEn);
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
                    <span className="text-muted block text-xs">{dueOf(instalment)}</span>
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
                  <td className="px-4 py-3 text-end">{actionOf(instalment)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
