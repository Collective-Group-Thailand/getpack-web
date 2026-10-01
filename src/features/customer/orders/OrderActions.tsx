"use client";

import { useTranslations } from "next-intl";

import { nextActionMeta, type NextAction } from "@/domain/status/next-action";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";

import { PayInstalmentButton, type PayableInstalment } from "../checkout/PayInstalmentButton";
import { actionHref, type Surface } from "./actions";

export interface OrderActionsProps {
  orderId: string;
  orderCode: string;
  /** The order's own `nextActions` (U-B0.3). */
  actions: readonly NextAction[];
  /** The instalment that can be paid now, when there is one (`StoreInstalmentDto.payable`). */
  payable?: PayableInstalment | null;
  size?: "sm" | "md";
  /** Where the order is shown: the account, or LINE's LIFF (D-151). */
  surface?: Surface;
}

/**
 * The actions the API offers on an order, the first one leading (design-system.md §4: the single
 * next best action), each named with the order code for a screen reader. Paying is not an order
 * action: it is the instalment's (`payable`), so it leads when one can be paid. An action the API
 * offers blocked says why, in the problem's words where this app has them.
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
  const tProblems = useTranslations("problems");
  const seen = new Set<string>();
  const unique = actions.filter((action) => (seen.has(action.key) ? false : (seen.add(action.key), true)));
  const reasonOf = (reason: string) => (tProblems.has(reason) ? tProblems(reason) : reason);
  return (
    <div className="flex flex-wrap items-start gap-2">
      {payable ? (
        <PayInstalmentButton
          size={size}
          iconStart={nextActionMeta("pay").icon}
          instalment={payable}
          orderCode={orderCode}
          surface={surface}
        >
          {t("action.payInstalment")}
          <span className="sr-only"> {orderCode}</span>
        </PayInstalmentButton>
      ) : null}
      {unique.map((action, index) => {
        const meta = nextActionMeta(action.key);
        const variant = index === 0 && !payable ? "primary" : "secondary";
        const label = (
          <>
            {t(meta.labelKey)}
            <span className="sr-only"> {orderCode}</span>
          </>
        );
        if (action.disabledReason) {
          const reason = reasonOf(action.disabledReason);
          return (
            <span key={action.key} className="flex flex-col gap-1">
              <Button size={size} variant="secondary" iconStart={meta.icon} disabled title={reason}>
                {label}
              </Button>
              <span className="text-muted text-xs">{reason}</span>
            </span>
          );
        }
        const href = actionHref(orderId, action.key, surface);
        return (
          <Button key={action.key} asChild size={size} variant={variant} iconStart={meta.icon}>
            <Link href={href ?? `/account/orders/${orderId}`}>{label}</Link>
          </Button>
        );
      })}
    </div>
  );
}
