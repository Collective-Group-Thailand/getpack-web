"use client";

import { useTranslations } from "next-intl";

import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import type { EditorMode } from "../../store/mode";

/** "ง่าย / มืออาชีพ" (D-456): one document, two tool sets; the choice follows the account. */
export function ModeSwitch({
  mode,
  onMode,
  className,
}: {
  mode: EditorMode;
  onMode: (mode: EditorMode) => void;
  className?: string;
}) {
  const t = useTranslations("designer.shell.mode");
  return (
    <div
      role="radiogroup"
      aria-label={t("label")}
      className={cn("border-border bg-surface-subtle inline-flex gap-0.5 rounded-lg border p-[3px]", className)}
    >
      {(
        [
          ["easy", "sparkles"],
          ["pro", "sliders"],
        ] as const
      ).map(([value, icon]) => {
        const on = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            title={t(`${value}Hint`)}
            onClick={() => onMode(value)}
            className={cn(
              "focus-visible:ring-focus-ring inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-semibold whitespace-nowrap outline-none focus-visible:ring-2",
              on ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
            )}
          >
            <Icon name={icon} size={15} aria-hidden="true" className={on ? "text-primary" : undefined} />
            {t(value)}
          </button>
        );
      })}
    </div>
  );
}

export type ShellStep = "design" | "check" | "order";

/** The three steps in the top bar — ออกแบบ · ตรวจงาน (findings) · สั่งผลิต — each opens its inspector tab. */
export function StepNav({
  step,
  onStep,
  blocking,
  advice,
  className,
}: {
  step: ShellStep;
  onStep: (step: ShellStep) => void;
  /** Must-fix findings (red badge); advice only shows when there is nothing to fix. */
  blocking: number;
  advice: number;
  className?: string;
}) {
  const t = useTranslations("designer.shell.steps");
  return (
    <nav
      aria-label={t("label")}
      className={cn("border-border bg-surface-subtle flex gap-0.5 rounded-lg border p-[3px]", className)}
    >
      {(["design", "check", "order"] as const).map((value, i) => (
        <button
          key={value}
          type="button"
          aria-current={step === value ? "step" : undefined}
          onClick={() => onStep(value)}
          className={cn(
            "focus-visible:ring-focus-ring inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[13px] font-medium whitespace-nowrap outline-none focus-visible:ring-2",
            step === value ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
          )}
        >
          <i className="text-muted text-[10.5px] font-semibold not-italic tabular-nums">{i + 1}</i>
          <span className="max-[1380px]:sr-only">{t(value)}</span>
          {value === "check" ? <IssueBadge blocking={blocking} advice={advice} /> : null}
        </button>
      ))}
    </nav>
  );
}

/** The findings' count: red with must-fix ones, amber with advice only, nothing when clean. */
export function IssueBadge({ blocking, advice }: { blocking: number; advice: number }) {
  const t = useTranslations("designer.shell.steps");
  if (!blocking && !advice) return null;
  return (
    <span
      className={cn(
        "inline-grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[11px] leading-none font-semibold tabular-nums",
        blocking ? "bg-danger text-danger-fg" : "bg-warning text-warning-fg",
      )}
    >
      {blocking || advice}
      <span className="sr-only">{blocking ? t("mustFix", { count: blocking }) : t("advice", { count: advice })}</span>
    </span>
  );
}
