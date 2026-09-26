"use client";

import { useTranslations } from "next-intl";

import { nextActionMeta, type NextAction } from "@/domain/status/next-action";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";

import { PayInstalmentButton } from "../checkout/PayInstalmentButton";
import { actionHref, type Surface } from "./actions";

export interface OrderActionsProps {
  orderId: string;
  orderCode: string;
  actions: readonly NextAction[];
  /** The instalment "pay" pays, when the order has one due. */
  payable?: { id: string; label: string; grossAmount: string; activePaymentId: string | null } | null;
  size?: "sm" | "md";
  /** Where the order is shown: the account, or LINE's LIFF (D-151). */
  surface?: Surface;
}

/**
 * The actions the API offers on an order, the first one leading (design-system.md §4: the single
 * next best action), each named with the order code for a screen reader.
 */
export function OrderActions({
  orderId,
  orderCode,
  actions,
  payable,
  size = "md",
  surface = "account",
}: OrderActionsProps) {
  const t = useTranslations("status");
  const seen = new Set<string>();
  const unique = actions.filter((action) => (seen.has(action.key) ? false : (seen.add(action.key), true)));
  return (
    <div className="flex flex-wrap gap-2">
      {unique.map((action, index) => {
        const meta = nextActionMeta(action.key);
        const variant = index === 0 ? "primary" : "secondary";
        const label = (
          <>
            {t(meta.labelKey)}
            <span className="sr-only"> {orderCode}</span>
          </>
        );
        if (action.key === "order.pay_instalment") {
          return payable ? (
            <PayInstalmentButton
              key={action.key}
              size={size}
              variant={variant}
              iconStart={meta.icon}
              instalment={payable}
              orderCode={orderCode}
              surface={surface}
            >
              {label}
            </PayInstalmentButton>
          ) : null;
        }
        const href = actionHref(orderId, action.key, surface);
        return (
          <Button
            key={action.key}
            asChild
            size={size}
            variant={variant}
            iconStart={meta.icon}
            disabled={Boolean(action.disabledReason)}
            title={action.disabledReason ?? undefined}
          >
            <Link href={href ?? `/account/orders/${orderId}`}>{label}</Link>
          </Button>
        );
      })}
    </div>
  );
}
