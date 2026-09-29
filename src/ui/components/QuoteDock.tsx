"use client";

import { lazy, Suspense, useState } from "react";

import { cn } from "../lib/cn";
import { Button } from "./Button";

// The phone sheet (Radix Dialog) loads on the first "details" tap, not with the page.
const Sheet = lazy(() => import("./Sheet").then((module) => ({ default: module.Sheet })));

export interface QuoteDockProps {
  /** "ราคาของคุณ" — the dock's heading, and the mobile sheet's title. */
  title: React.ReactNode;
  /** The figure a customer looks for first: "฿12.50 / ชิ้น". */
  headline: React.ReactNode;
  /** Under it: "รวม ฿13,380.00 · 1,000 ชิ้น". */
  subline?: React.ReactNode;
  /** Replaces the headline while a price is being worked out or cannot be given. */
  status?: React.ReactNode;
  /** Everything else: the summary, price breaks, dates, validity. */
  children: React.ReactNode;
  /** The one primary action, shown in the mobile bar as well as the panel. */
  primaryAction: React.ReactNode;
  /** The rest of the actions, in the panel and the mobile sheet. */
  secondaryActions?: React.ReactNode;
  /** "ดูรายละเอียด" — opens the mobile sheet. */
  detailsLabel: string;
  closeLabel: string;
  /** The storefront's phone nav is fixed to the bottom; the bar sits above it. */
  aboveBottomNav?: boolean;
  /** Announces price changes politely while the customer keeps typing. */
  live?: boolean;
  className?: string;
}

/**
 * The instant-quote dock (design-system.md §3 "QuoteDock", §5 "sticky quote dock").
 *
 * From `md` up it is a sticky side panel beside the configurator, so price and date stay in view
 * while every choice is made. On a phone it is a bar in the thumb zone — headline, the primary
 * action and "details" — and the details open as a bottom sheet, so the configurator keeps the
 * screen. The bar reserves its own height (`QuoteDockSpacer`) so nothing on the page ends up
 * underneath it (WCAG 2.4.11, focus not obscured).
 *
 * The headline sits in a polite live region: a new price is announced once the customer pauses,
 * never mid-keystroke, because the caller only changes it after its debounce.
 */
export function QuoteDock({
  title,
  headline,
  subline,
  status,
  children,
  primaryAction,
  secondaryActions,
  detailsLabel,
  closeLabel,
  aboveBottomNav = true,
  live = true,
  className,
}: QuoteDockProps) {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const figure = (
    <div aria-live={live ? "polite" : undefined} aria-atomic="true">
      {status ?? (
        <>
          <p className="text-2xl font-bold tabular-nums">{headline}</p>
          {subline ? <p className="text-muted text-sm tabular-nums">{subline}</p> : null}
        </>
      )}
    </div>
  );

  return (
    <>
      <aside
        aria-label={typeof title === "string" ? title : undefined}
        className={cn(
          "border-border bg-surface-raised rounded-card shadow-card sticky top-20 hidden flex-col gap-4 border p-5 md:flex",
          className,
        )}
      >
        <h2 className="text-muted text-sm font-medium">{title}</h2>
        {figure}
        {children}
        <div className="flex flex-col gap-2">
          {primaryAction}
          {secondaryActions}
        </div>
      </aside>

      <div
        className={cn(
          "border-border bg-surface-raised z-sticky shadow-overlay fixed inset-x-0 border-t px-4 py-3 md:hidden",
          aboveBottomNav ? "bottom-[calc(3.5rem+1px)]" : "bottom-0",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1" aria-live={live ? "polite" : undefined} aria-atomic="true">
            {status ?? (
              <>
                <p className="truncate text-lg font-bold tabular-nums">{headline}</p>
                {subline ? <p className="text-muted truncate text-xs tabular-nums">{subline}</p> : null}
              </>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setOpened(true);
              setOpen(true);
            }}
          >
            {detailsLabel}
          </Button>
          <div className="shrink-0">{primaryAction}</div>
        </div>
      </div>

      {opened ? (
        <Suspense fallback={null}>
          <Sheet
            side="bottom"
            open={open}
            onOpenChange={setOpen}
            title={title}
            closeLabel={closeLabel}
            footer={
              <div className="flex w-full flex-col gap-2">
                {primaryAction}
                {secondaryActions}
              </div>
            }
          >
            <div className="flex flex-col gap-4">
              {figure}
              {children}
            </div>
          </Sheet>
        </Suspense>
      ) : null}
    </>
  );
}

/** Room at the end of the page for the phone bar, so the last field is never under it. */
export function QuoteDockSpacer() {
  return <div aria-hidden className="h-20 md:hidden" />;
}
