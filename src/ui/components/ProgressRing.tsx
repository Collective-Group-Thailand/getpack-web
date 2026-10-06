import { cn } from "../lib/cn";

/**
 * A ring that empties as something runs out — a QR's validity, a hold (round 2, B12). Decorative:
 * the time left is always written beside it, so the ring itself is hidden from assistive tech.
 */
export function ProgressRing({
  value,
  size = 56,
  stroke = 5,
  tone = "primary",
  className,
  children,
}: {
  /** 0–1, how much is left. */
  value: number;
  size?: number;
  stroke?: number;
  tone?: "primary" | "warning" | "danger";
  className?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const left = Math.min(1, Math.max(0, value));
  return (
    <span className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-border" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - left)}
          className={cn(
            "transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none",
            tone === "primary" && "stroke-primary",
            tone === "warning" && "stroke-warning",
            tone === "danger" && "stroke-danger",
          )}
        />
      </svg>
      {children ? <span className="absolute inset-0 grid place-items-center">{children}</span> : null}
    </span>
  );
}
