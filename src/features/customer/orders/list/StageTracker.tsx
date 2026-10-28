import { useTranslations } from "next-intl";

import { CUSTOMER_ORDER_STAGE, ORDER_STAGES } from "@/domain/status";
import { cn } from "@/ui/lib/cn";

/**
 * The orders list's six-stage tracker (account pack Phase 2 item 4): ชำระเงิน → ไฟล์งาน → อนุมัติแบบ → ผลิต →
 * จัดส่ง → รับของ, read off the API's customer status (`CUSTOMER_ORDER_STAGE`); the current stage is half-filled,
 * red when the payment is overdue. Nothing for a cancelled order.
 */
export function StageTracker({ status, overdue, className }: { status: string; overdue: boolean; className?: string }) {
  const t = useTranslations("myOrders.list.stages");
  const current = CUSTOMER_ORDER_STAGE[status as keyof typeof CUSTOMER_ORDER_STAGE] ?? null;
  if (current === null) return null;
  const label =
    current >= ORDER_STAGES.length
      ? t("allDone")
      : t("currentOf", { stage: t(ORDER_STAGES[current]!), n: current + 1, total: ORDER_STAGES.length });
  return (
    <ol aria-label={label} className={cn("grid grid-cols-6 gap-1 sm:gap-1.5", className)}>
      {ORDER_STAGES.map((stage, index) => {
        const done = index < current;
        const now = index === current;
        const late = now && overdue;
        return (
          <li
            key={stage}
            aria-current={now ? "step" : undefined}
            className={cn(
              "flex min-w-0 flex-col gap-1.5 text-[0.65625rem] sm:text-xs",
              done
                ? "text-muted"
                : now
                  ? late
                    ? "text-danger font-semibold"
                    : "text-fg font-semibold"
                  : "text-muted/70",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "relative h-1.5 overflow-hidden rounded-sm",
                done ? "bg-primary" : late ? "bg-danger" : "bg-bg-subtle",
              )}
            >
              {now && !late ? <span className="bg-primary absolute inset-y-0 start-0 w-1/2" /> : null}
            </span>
            <span className="truncate">{t(stage)}</span>
          </li>
        );
      })}
    </ol>
  );
}
