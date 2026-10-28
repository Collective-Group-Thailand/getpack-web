"use client";

import { useEffect } from "react";

import { trackAccount, type AccountEvents } from "@/lib/analytics/account";

/** Reports `order_view` once the order page is shown (account pack Phase 3 item 10). */
export function OrderViewTracker({ status }: { status: string }) {
  useEffect(() => {
    trackAccount("order_view", { status });
  }, [status]);
  return null;
}

/** A wrapper that reports one account event when anything inside it is clicked (links, buttons). */
export function TrackClicks<K extends "order_reorder" | "order_message_send" | "order_claim_add">({
  event,
  properties,
  children,
  className,
}: {
  event: K;
  properties: AccountEvents[K];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    // A click on any control inside counts; the wrapper itself is not interactive.
    <div
      className={className}
      onClick={(clickEvent) => {
        if ((clickEvent.target as HTMLElement).closest("a,button")) trackAccount(event, properties);
      }}
    >
      {children}
    </div>
  );
}
