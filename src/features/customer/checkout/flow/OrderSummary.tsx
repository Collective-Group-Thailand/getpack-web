"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { PriceSummary, type PriceRow } from "@/ui/components/PriceSummary";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export interface SummaryAction {
  label: string;
  /** A link to the next page, or an action on this one. */
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export interface TrustLine {
  icon: IconName;
  text: React.ReactNode;
}

/**
 * The order summary on every step (checkout redesign item 6), sticky beside the step from 1100 px: the rows the
 * API gave (goods incl. VAT, discount, delivery, VAT included, the total — `PriceSummary` shows them and adds nothing
 * up), the codes, what still blocks the next step ("ก่อนไปต่อ"), the step's primary action, the cart's secondary
 * actions, and the trust lines. Blockers are announced; the primary action is disabled while there are any, and a
 * press on it then says why (`onBlocked`).
 */
export function OrderSummary({
  rows,
  total,
  pending = false,
  codes,
  extra,
  blockers,
  primary,
  onBlocked,
  secondary,
  trust,
  notices,
}: {
  rows: PriceRow[];
  total: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode };
  pending?: boolean;
  codes?: React.ReactNode;
  /** Under the totals: what is due today, the tax invoice it goes to, points to earn. */
  extra?: React.ReactNode;
  blockers: readonly string[];
  primary: SummaryAction;
  onBlocked?: () => void;
  secondary?: React.ReactNode;
  trust: readonly TrustLine[];
  notices?: React.ReactNode;
}) {
  const t = useTranslations("checkout.flow.summary");
  const blocked = blockers.length > 0;
  return (
    <aside
      aria-labelledby="order-summary-title"
      className="min-[1100px]:sticky min-[1100px]:top-[calc(var(--site-sticky-top,4rem)+1.25rem)] min-[1100px]:self-start"
    >
      <div className="border-border bg-surface rounded-card flex flex-col gap-3.5 border p-5.5">
        <h2 id="order-summary-title" className="m-0 text-lg font-semibold">
          {t("title")}
        </h2>
        <div className={cn(pending && "opacity-60")} aria-busy={pending || undefined} aria-live="polite">
          <PriceSummary aria-label={t("title")} rows={rows} total={total} emphasis="strong" />
        </div>
        {extra}
        {codes}
        {notices}
        {blocked ? (
          <div
            role="status"
            className="bg-instant-subtle text-fg rounded-xl px-3.5 py-3 text-[13px] leading-relaxed"
            aria-label={t("blockedTitle")}
          >
            <p className="text-instant-subtle-fg m-0 font-semibold">{t("blockedTitle")}</p>
            <ul className="m-0 mt-1 flex list-disc flex-col gap-1 ps-4">
              {blockers.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <PrimaryAction action={primary} blocked={blocked} onBlocked={onBlocked} size="lg" />
        {secondary}
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[12.5px] leading-snug">
          {trust.map((line, index) => (
            <li key={index} className="text-muted flex gap-2">
              <Icon name={line.icon} size={15} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
              <span>{line.text}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted m-0 text-xs">{t("fine")}</p>
      </div>
    </aside>
  );
}

/** The step's primary action — a link to the next page or a button — held while something blocks it. */
export function PrimaryAction({
  action,
  blocked,
  onBlocked,
  size,
  className,
}: {
  action: SummaryAction;
  blocked: boolean;
  onBlocked?: () => void;
  size?: "md" | "lg";
  className?: string;
}) {
  if (blocked || action.disabled) {
    // `aria-disabled` keeps it focusable and pressable, so a press can say what is missing (focus moves there).
    return (
      <Button
        block
        size={size}
        className={cn("opacity-50", className)}
        aria-disabled="true"
        loading={action.loading}
        onClick={() => onBlocked?.()}
      >
        {action.label}
      </Button>
    );
  }
  if (action.href)
    return (
      <Button asChild block size={size} className={className}>
        <Link href={action.href}>{action.label}</Link>
      </Button>
    );
  return (
    <Button block size={size} loading={action.loading} onClick={action.onClick} className={className}>
      {action.label}
    </Button>
  );
}

/** Below 640 px: the total and the primary action, fixed at the bottom (checkout redesign item 1). */
export function MobileBar({
  total,
  note,
  action,
  blocked,
  onBlocked,
}: {
  total: React.ReactNode;
  note: React.ReactNode;
  action: SummaryAction;
  blocked: boolean;
  onBlocked?: () => void;
}) {
  return (
    <div className="border-border bg-surface fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] sm:hidden">
      <div className="min-w-0 flex-1 leading-tight">
        <b className="text-primary block text-lg font-semibold tabular-nums">{total}</b>
        <small className="text-muted block text-xs">{note}</small>
      </div>
      <PrimaryAction action={action} blocked={blocked} onBlocked={onBlocked} className="w-auto shrink-0" />
    </div>
  );
}
