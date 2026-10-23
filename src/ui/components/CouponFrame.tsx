import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";

export interface CouponFrameProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** The frame's heading; `titleId` names it for `aria-labelledby`. */
  title: React.ReactNode;
  titleId?: string;
  /** A line under the heading, with `hintId` when a control describes itself by it. */
  hint?: React.ReactNode;
  hintId?: string;
  icon?: IconName;
  children?: React.ReactNode;
}

/**
 * A frame shaped like a coupon: a dashed amber border, a notch on each side and a ticket in a
 * solid amber disc.
 *
 * Amber (`accent`) is for promotions only (D-180), and this is the one piece of UI that *is* a
 * promotion — where a customer enters a discount code. It lives in `src/ui` so a feature can
 * use the accent tone without styling it locally; the lint rule keeps amber out of feature code.
 * The notches are decoration (`aria-hidden`) over the parent's surface.
 */
export function CouponFrame({
  title,
  titleId,
  hint,
  hintId,
  icon = "ticket",
  className,
  children,
  ...props
}: CouponFrameProps) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "border-accent/70 bg-accent-subtle/40 rounded-card relative overflow-hidden border-2 border-dashed p-4",
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="bg-surface absolute top-7 -left-2.5 size-5 rounded-full" />
      <span aria-hidden="true" className="bg-surface absolute top-7 -right-2.5 size-5 rounded-full" />
      <div className="flex items-start gap-3">
        <span
          className="bg-accent text-accent-fg grid size-10 shrink-0 place-items-center rounded-full"
          aria-hidden="true"
        >
          <Icon name={icon} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="text-[15px] leading-tight font-bold">
            {title}
          </h3>
          {hint ? (
            <p id={hintId} className="text-muted mt-0.5 text-[13px]">
              {hint}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/** A row inside the frame that names a promotion and what it is worth — amber sparkle, green amount. */
export function CouponSavingRow({ name, amount }: { name: React.ReactNode; amount: React.ReactNode }) {
  return (
    <li className="flex justify-between gap-3">
      <span className="flex min-w-0 items-center gap-1.5">
        <Icon name="sparkles" size={14} aria-hidden="true" className="text-accent-subtle-fg shrink-0" />
        <span className="truncate">{name}</span>
      </span>
      <b className="text-success-subtle-fg shrink-0 tabular-nums">{amount}</b>
    </li>
  );
}

/** The dashed rule that separates the frame's savings from its codes. */
export function CouponDivider({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn("border-accent/40 mt-3 flex flex-col gap-1 border-t border-dashed pt-3 text-sm", className)}
      {...props}
    />
  );
}
