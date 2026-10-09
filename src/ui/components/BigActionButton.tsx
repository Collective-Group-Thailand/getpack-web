import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";
import { Spinner } from "./Spinner";

export interface BigActionButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  /** What pressing it does, as a verb: "เริ่มพิมพ์", "รับงาน". */
  title: React.ReactNode;
  /** One line of consequence under it: "เหลือเวลารับงาน 3 ชม.". */
  hint?: React.ReactNode;
  icon?: IconName;
  tone?: "primary" | "secondary" | "danger";
  loading?: boolean;
}

/**
 * The one primary action of a shop-floor screen (design-system.md §1 "one primary action per
 * view", §5 Partner): full width, at least 64 px tall, 20 px text, the consequence spelled out
 * under the verb — pressed with a thumb, sometimes in gloves, read at arm's length.
 */
export function BigActionButton({
  title,
  hint,
  icon,
  tone = "primary",
  loading = false,
  disabled,
  className,
  type = "button",
  ...props
}: BigActionButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-big=""
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-xl px-4 py-2.5 text-start",
        "duration-fast ease-standard transition-colors disabled:opacity-50",
        tone === "primary" && "bg-primary text-primary-fg hover:bg-primary-hover",
        tone === "secondary" && "border-border-strong bg-surface text-fg hover:bg-surface-subtle border",
        tone === "danger" && "bg-danger text-danger-fg hover:bg-danger-hover",
        className,
      )}
      {...props}
    >
      {loading ? <Spinner size={22} label={null} /> : icon ? <Icon name={icon} size={22} className="shrink-0" /> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{title}</span>
        {hint ? <span className="block text-sm opacity-90">{hint}</span> : null}
      </span>
    </button>
  );
}
