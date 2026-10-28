"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { trackAccount } from "@/lib/analytics/account";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";

import { RequoteButton } from "../RequoteButton";

/**
 * Orders paid together (D-110: one checkout, several orders) inside one frame (account pack Phase 2 item 5):
 * "ชำระรวม <group>" with the number of orders, the group's amount and deadline — "เลยกำหนดชำระ" and
 * "ตรวจราคาใหม่และชำระ" past it (D-436), else one pay button for the whole group. Figures are the API's
 * (`OrderDto.payment`).
 */
export function PayGroupFrame({
  payment,
  firstOrderId,
  children,
}: {
  payment: Schemas["OrderPaymentShareDto"];
  firstOrderId: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("myOrders.list.group");
  const format = useFormat();
  const payHref = `/account/orders/${firstOrderId}#payment`;
  return (
    <section
      aria-label={t("label", { code: payment.groupCode })}
      className="border-border-strong flex flex-col gap-2.5 rounded-[20px] border border-dashed p-2.5 sm:p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-1.5 py-0.5">
        <p className="min-w-0 text-sm">
          <span className="font-semibold tabular-nums">{t("title", { code: payment.groupCode })}</span>{" "}
          <span className="text-muted text-[0.8125rem] tabular-nums">
            ·{" "}
            {[
              t("count", { count: payment.groupOrderCount }),
              format.thb(payment.groupGrossAmount),
              payment.dueAt ? t("dueBy", { date: format.dateTime(payment.dueAt) }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          {payment.overdue ? (
            <Badge size="sm" tone="danger" icon="clock" className="ms-1.5 align-middle">
              {t("late")}
            </Badge>
          ) : null}
        </p>
        {payment.overdue ? (
          <RequoteButton
            size="sm"
            groupId={payment.groupId}
            payHref={payHref}
            onOpen={() => trackAccount("orders_action", { action: "requote", status: "awaiting_payment" })}
          />
        ) : (
          <Button asChild size="sm" iconStart="credit-card">
            <Link
              href={payHref}
              onClick={() => trackAccount("orders_action", { action: "pay", status: "awaiting_payment" })}
            >
              {t("pay", { amount: format.thb(payment.groupGrossAmount) })}
            </Link>
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}
