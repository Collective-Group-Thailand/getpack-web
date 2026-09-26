"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { INSTALMENT_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

import { PayInstalmentButton } from "./PayInstalmentButton";

type Instalment = ResponseOf<Requests, "GET /v1/store/instalments">["data"][number];

/**
 * The instalment centre (F3 3.3, D-020): every instalment across the customer's orders, when it is
 * due, what is paid, the receipt for each one paid, and paying the next one.
 */
export function InstalmentList({ instalments }: { instalments: Instalment[] }) {
  const t = useTranslations("instalments");
  const format = useFormat();

  if (instalments.length === 0) {
    return <EmptyState className="mt-8" icon="wallet" title={t("emptyTitle")} description={t("emptyBody")} />;
  }

  return (
    <div className="border-border mt-6 overflow-x-auto rounded-xl border">
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
          {instalments.map((instalment) => (
            <tr key={instalment.id} className="border-border border-t">
              <th scope="row" className="px-4 py-3 text-start font-medium">
                <Link
                  href={`/account/orders/${instalment.order.id}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {instalment.order.orderCode}
                </Link>
                <span className="text-muted block text-xs font-normal">{instalment.groupCode}</span>
              </th>
              <td className="px-4 py-3">
                {instalment.label}
                <span className="text-muted block text-xs">
                  {instalment.dueAt
                    ? t("dueBy", { date: format.date(instalment.dueAt) })
                    : t(`trigger.${instalment.dueTrigger}`)}
                </span>
              </td>
              <td className="px-4 py-3 text-end tabular-nums">{format.thb(instalment.grossAmount)}</td>
              <td className="px-4 py-3">
                <StatusChip map={INSTALMENT_STATUS} value={instalment.status} />
              </td>
              <td className="px-4 py-3 text-end">
                {instalment.payable ? (
                  <PayInstalmentButton size="sm" instalment={instalment} orderCode={instalment.order.orderCode}>
                    {instalment.activePaymentId ? t("continue") : t("pay")}
                    <span className="sr-only">
                      {" "}
                      {instalment.order.orderCode} {instalment.label}
                    </span>
                  </PayInstalmentButton>
                ) : instalment.receipt?.url ? (
                  <Button size="sm" variant="ghost" asChild iconStart="download">
                    <a href={instalment.receipt.url} target="_blank" rel="noopener noreferrer">
                      {t("receipt")}
                      <span className="sr-only">
                        {" "}
                        {instalment.order.orderCode} {instalment.label}
                      </span>
                    </a>
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
