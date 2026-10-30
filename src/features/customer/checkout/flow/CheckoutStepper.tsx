"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { CHECKOUT_STEPS, stepHref, stepIndex, type CheckoutStep } from "./steps";

/**
 * The four steps on every page of buying (checkout redesign item 1): a `nav` of the steps in order, the current one
 * `aria-current="step"`, a finished one ticked (an icon and the words "เสร็จแล้ว", never colour alone). Earlier steps
 * are always open; a later one only once every step before it is valid (`reachable`). A step on another page is a
 * link; one on this page calls `onSelect`. On a phone only the numbers show; each keeps its name for screen readers.
 */
export function CheckoutStepper({
  current,
  reachable,
  onSelect,
  inPage = [],
  className,
}: {
  current: CheckoutStep;
  /** The furthest step the customer may open now. */
  reachable: CheckoutStep;
  /** Steps shown on this page: selecting one calls `onSelect` instead of following a link. */
  inPage?: readonly CheckoutStep[];
  onSelect?: (step: CheckoutStep) => void;
  className?: string;
}) {
  const t = useTranslations("checkout.flow");
  const at = stepIndex(current);
  return (
    <nav aria-label={t("stepsLabel")} className={cn("mt-5 mb-2", className)}>
      <ol className="border-border bg-surface rounded-card m-0 flex list-none overflow-hidden border p-0">
        {CHECKOUT_STEPS.map((step, index) => {
          const done = index < at;
          const isCurrent = index === at;
          const open = !isCurrent && index <= stepIndex(reachable);
          const body = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-6.5 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums",
                  done && "bg-primary text-primary-fg",
                  isCurrent && "bg-primary text-primary-fg",
                  !done && !isCurrent && "bg-bg-subtle text-muted",
                )}
              >
                {done ? <Icon name="check" size={14} /> : index + 1}
              </span>
              <span className="leading-tight max-sm:sr-only">{t(`steps.${step}`)}</span>
              {done ? <span className="sr-only">{t("stepState.done")}</span> : null}
              {!open && !isCurrent ? <span className="sr-only">{t("stepState.locked")}</span> : null}
            </>
          );
          const cell = cn(
            "flex min-h-12 w-full min-w-0 items-center gap-2.5 px-4 py-3 text-start text-sm font-medium max-sm:justify-center",
            "focus-visible:ring-focus-ring outline-none focus-visible:ring-2 focus-visible:ring-inset",
            done ? "text-fg/80" : "text-muted",
            // The current step: the brand tint with a green rule under it (Project A), never a black chip.
            isCurrent &&
              "bg-primary-subtle text-fg after:bg-primary relative after:absolute after:inset-x-0 after:bottom-0 after:h-0.5",
          );
          return (
            <li key={step} className="border-border min-w-0 flex-1 border-e last:border-e-0">
              {isCurrent ? (
                <span aria-current="step" className={cell}>
                  {body}
                </span>
              ) : !open ? (
                <span aria-disabled="true" className={cn(cell, "cursor-not-allowed opacity-70")}>
                  {body}
                </span>
              ) : inPage.includes(step) && onSelect ? (
                <button type="button" className={cn(cell, "hover:bg-bg-subtle")} onClick={() => onSelect(step)}>
                  {body}
                </button>
              ) : (
                <Link href={stepHref(step)} className={cn(cell, "hover:bg-bg-subtle no-underline")}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
