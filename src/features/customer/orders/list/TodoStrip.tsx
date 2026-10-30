"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { trackAccount } from "@/lib/analytics/account";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { artworkNoteOf, visibleActions } from "../order-state";
import { RequoteButton } from "../RequoteButton";

type Order = Schemas["OrderDto"];

interface Todo {
  key: string;
  tone: "pay" | "file" | "recv" | "claim";
  icon: IconName;
  title: string;
  detail: string;
  late?: boolean;
  action: React.ReactNode;
}

const TONES: Record<Todo["tone"], string> = {
  pay: "bg-danger-subtle text-danger-subtle-fg",
  file: "bg-info-subtle text-info-subtle-fg",
  recv: "bg-success-subtle text-success-subtle-fg",
  claim: "bg-warning-subtle text-warning-subtle-fg",
};

/**
 * "ต้องทำตอนนี้" (account pack Phase 2 item 2; Phase 4 reuses it): only the cards that apply, from the customer's
 * active orders as the API states them — one per unpaid payment group (its amount and deadline, "เลยกำหนดชำระ"
 * past it with "ตรวจราคาใหม่และชำระ", D-436) · ส่งไฟล์งาน while the customer owns the artwork step — or, when the
 * team owes the dieline, what happens next and no upload button (D-438) · ยืนยันรับของ · เคลมกำลังตรวจ.
 */
export function TodoStrip({
  orders,
  className,
  layout = "cards",
  empty = null,
}: {
  orders: Order[];
  className?: string;
  /** `list`: one card headed "ต้องทำตอนนี้", a row per item with its action at the end (the account overview). */
  layout?: "cards" | "list";
  /** What shows when nothing waits for the customer (the overview's calm line); nothing by default. */
  empty?: React.ReactNode;
}) {
  const t = useTranslations("myOrders.list.todo");
  const format = useFormat();
  const report = (action: string, status: string) => () => trackAccount("orders_action", { action, status });
  const todos: Todo[] = [];

  // Pay: one card per payment group still unpaid.
  const groups = new Map<string, Order[]>();
  for (const order of orders.filter((candidate) => candidate.customerStatus === "awaiting_payment")) {
    groups.set(order.payment.groupId, [...(groups.get(order.payment.groupId) ?? []), order]);
  }
  for (const [groupId, members] of groups) {
    const first = members[0]!;
    const { payment } = first;
    todos.push({
      key: `pay-${groupId}`,
      tone: "pay",
      icon: "wallet",
      title:
        payment.groupOrderCount > 1
          ? t("payGroup", { amount: format.thb(payment.groupGrossAmount) })
          : t("pay", { amount: format.thb(payment.groupGrossAmount) }),
      detail: [
        payment.groupOrderCount > 1 ? t("orderCount", { count: payment.groupOrderCount }) : first.orderCode,
        payment.dueAt ? t("dueBy", { date: format.dateTime(payment.dueAt) }) : null,
      ]
        .filter(Boolean)
        .join(" · "),
      late: payment.overdue,
      action: payment.overdue ? (
        <RequoteButton
          size="sm"
          groupId={groupId}
          payHref={`/account/orders/${first.id}#payment`}
          onOpen={report("requote", first.customerStatus)}
        />
      ) : (
        <Button asChild size="sm" iconStart="credit-card">
          <Link href={`/account/orders/${first.id}#payment`} onClick={report("pay", first.customerStatus)}>
            {t("payAction")}
          </Link>
        </Button>
      ),
    });
  }

  // Files: the customer's to send, else the team's dieline to wait for (no upload button then).
  const uploads = orders.filter((order) =>
    visibleActions(order, order.nextActions).some((action) => action.key === "order.upload_artwork"),
  );
  const waitingDieline = orders.filter((order) => artworkNoteOf(order) === "team_dieline");
  if (uploads.length > 0) {
    const first = uploads[0]!;
    todos.push({
      key: "upload",
      tone: "file",
      icon: "upload",
      title:
        uploads.length > 1 ? t("uploadMany", { count: uploads.length }) : t("uploadOne", { code: first.orderCode }),
      detail: t("uploadDetail"),
      action: (
        <Button asChild size="sm" variant="secondary" iconStart="upload">
          <Link
            href={`/account/orders/${first.id}/artwork`}
            onClick={report("order.upload_artwork", first.customerStatus)}
          >
            {t("uploadAction")}
          </Link>
        </Button>
      ),
    });
  } else if (waitingDieline.length > 0) {
    const first = waitingDieline[0]!;
    todos.push({
      key: "dieline",
      tone: "file",
      icon: "upload",
      title: t("dielineTitle", { code: first.orderCode }),
      detail: t("dielineDetail"),
      action: (
        <Button asChild size="sm" variant="secondary">
          <Link href={`/account/orders/${first.id}`}>{t("details")}</Link>
        </Button>
      ),
    });
  }

  // Receipt to confirm.
  const receive = orders.filter((order) =>
    visibleActions(order, order.nextActions).some((action) => action.key === "order.confirm_receipt"),
  );
  if (receive.length > 0) {
    const first = receive[0]!;
    todos.push({
      key: "receive",
      tone: "recv",
      icon: "package-check",
      title:
        receive.length > 1 ? t("receiveMany", { count: receive.length }) : t("receiveOne", { code: first.orderCode }),
      detail: t("receiveDetail"),
      action: (
        <Button asChild size="sm" variant="secondary" iconStart="check">
          <Link href={`/account/orders/${first.id}`} onClick={report("order.confirm_receipt", first.customerStatus)}>
            {t("receiveAction")}
          </Link>
        </Button>
      ),
    });
  }

  // Claims being reviewed.
  const claims = orders.flatMap((order) =>
    order.customerStatus === "claim_in_review" ? order.openClaims.map((claim) => ({ order, claim })) : [],
  );
  if (claims.length > 0) {
    const { order, claim } = claims[0]!;
    todos.push({
      key: "claim",
      tone: "claim",
      icon: "flag",
      title: t("claims", { count: claims.length }),
      detail: t("claimDetail", { claim: claim.claimNo, code: order.orderCode }),
      action: (
        <Button asChild size="sm" variant="secondary">
          <Link
            href={`/account/orders/${order.id}/claims/${claim.id}`}
            onClick={report("view_claim", order.customerStatus)}
          >
            {t("claimAction")}
          </Link>
        </Button>
      ),
    });
  }

  if (todos.length === 0) return <>{empty}</>;
  if (layout === "list")
    return (
      <section
        aria-labelledby="todo-now"
        className={cn("border-primary/30 bg-primary-subtle rounded-panel border p-1.5 sm:p-2", className)}
      >
        <h2 id="todo-now" className="flex items-center gap-2 px-3 pt-2.5 pb-2 text-[1.0625rem] font-semibold">
          {t("title")}
          <span className="bg-primary text-primary-fg grid size-6 place-items-center rounded-full text-xs tabular-nums">
            {todos.length}
          </span>
        </h2>
        <ul className="bg-surface border-border divide-border divide-y rounded-xl border">
          {todos.map((todo) => (
            <li
              key={todo.key}
              className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 p-3.5 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:p-4"
            >
              <span className={cn("rounded-control grid size-10 place-items-center", TONES[todo.tone])}>
                <Icon name={todo.icon} size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[0.9375rem] font-semibold tabular-nums">{todo.title}</p>
                <p className="text-muted mt-0.5 text-[0.8125rem]">
                  {todo.detail}
                  {todo.late ? (
                    <Badge size="sm" tone="danger" icon="clock" className="ms-1.5 align-middle">
                      {t("late")}
                    </Badge>
                  ) : null}
                </p>
              </div>
              <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:justify-end">{todo.action}</div>
            </li>
          ))}
        </ul>
      </section>
    );
  return (
    <section aria-labelledby="todo-now" className={className}>
      <h2 id="todo-now" className="sr-only">
        {t("title")}
      </h2>
      <ul className="grid gap-3 xl:grid-cols-3">
        {todos.map((todo) => (
          <li
            key={todo.key}
            className="border-border bg-surface grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3 rounded-2xl border p-4"
          >
            <span className={cn("rounded-control grid size-10 place-items-center", TONES[todo.tone])}>
              <Icon name={todo.icon} size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[0.90625rem] font-semibold tabular-nums">{todo.title}</p>
              <p className="text-muted mt-0.5 text-[0.78125rem]">
                {todo.detail}
                {todo.late ? (
                  <Badge size="sm" tone="danger" icon="clock" className="ms-1.5 align-middle">
                    {t("late")}
                  </Badge>
                ) : null}
              </p>
            </div>
            <div className="col-span-2 mt-1 flex flex-wrap gap-2">{todo.action}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
