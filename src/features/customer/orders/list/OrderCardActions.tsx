"use client";

import { useTranslations } from "next-intl";

import { nextActionMeta } from "@/domain/status/next-action";
import { Link } from "@/i18n/navigation";
import { trackAccount } from "@/lib/analytics/account";
import { Button } from "@/ui/components/Button";

import { actionHref } from "../actions";
import { RequoteButton } from "../RequoteButton";

export interface CardAction {
  /** A `nextActions` key, or `pay` / `requote` / `view_claim` (the list's own entry points). */
  key: string;
  href?: string;
}

/**
 * The one primary action of an order card for its current step, and at most one secondary (account pack Phase 2
 * item 4): pay — or "ตรวจราคาใหม่และชำระ" past the deadline (D-436) — then what the API offers (`nextActions`).
 * Each sits above the card's whole-card link and reports `orders_action`.
 */
export function OrderCardActions({
  orderId,
  orderCode,
  status,
  groupId,
  actions,
}: {
  orderId: string;
  orderCode: string;
  status: string;
  groupId: string;
  actions: CardAction[];
}) {
  const t = useTranslations("status");
  const tList = useTranslations("myOrders.list");
  const shown = actions.slice(0, 2);
  if (shown.length === 0) return null;
  const report = (action: string) => () => trackAccount("orders_action", { action, status });
  return (
    <div className="relative z-[1] flex flex-wrap justify-end gap-1.5">
      {shown.map((action) => {
        // One primary: the first action of the step; "ดูเคลม" is always the quieter one.
        const lead = shown.find((candidate) => candidate.key !== "view_claim");
        const variant = action === lead ? "primary" : "secondary";
        if (action.key === "requote") {
          return (
            <RequoteButton
              key={action.key}
              size="sm"
              variant={variant}
              groupId={groupId}
              payHref={`/account/orders/${orderId}#payment`}
              onOpen={report("requote")}
            />
          );
        }
        const label =
          action.key === "pay"
            ? tList("actions.pay")
            : action.key === "view_claim"
              ? tList("actions.viewClaim")
              : t(nextActionMeta(action.key).labelKey);
        const icon =
          action.key === "pay" ? "credit-card" : action.key === "view_claim" ? "eye" : nextActionMeta(action.key).icon;
        const href = action.href ?? actionHref(orderId, action.key, "account") ?? `/account/orders/${orderId}`;
        return (
          <Button key={action.key} asChild size="sm" variant={variant} iconStart={icon}>
            <Link href={href} onClick={report(action.key)}>
              {label}
              <span className="sr-only"> {orderCode}</span>
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
