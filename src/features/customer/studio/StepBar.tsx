"use client";

import { useTranslations } from "next-intl";

import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { lockedReason, STUDIO_STEPS, type StepFacts, type StudioStep } from "./steps";

/**
 * The thin step bar (studio-spec §2): เลือกกล่อง · ขนาดและวัสดุ · ออกแบบ · ตรวจงาน · สั่งผลิต.
 * Every open step can be gone back to without losing work; a step that cannot open yet says why.
 */
export function StepBar({
  step,
  facts,
  onStep,
}: {
  step: StudioStep;
  facts: StepFacts;
  onStep: (step: StudioStep) => void;
}) {
  const t = useTranslations("studio.steps");
  const current = STUDIO_STEPS.indexOf(step);
  return (
    <nav
      aria-label={t("label")}
      data-coach="studio-steps"
      className="border-border bg-surface shrink-0 overflow-x-auto border-b"
    >
      <ol className="flex min-w-max items-center gap-1 px-3 py-1.5">
        {STUDIO_STEPS.map((id, index) => {
          const locked = lockedReason(id, facts);
          const done = index < current;
          return (
            <li key={id} className="flex items-center gap-1">
              {index > 0 ? <Icon name="chevron-right" size={14} aria-hidden="true" className="text-muted" /> : null}
              <button
                type="button"
                // A locked step still answers a click — with why it is locked — rather than
                // doing nothing, which read as the bar being broken (owner walkthrough 2026-10-14).
                onClick={() => (locked ? toast.info(t(`locked.${locked}`)) : onStep(id))}
                aria-disabled={locked !== null || undefined}
                title={locked ? t(`locked.${locked}`) : undefined}
                aria-current={id === step ? "step" : undefined}
                aria-describedby={locked ? `studio-step-${id}-locked` : undefined}
                className={cn(
                  // No colour transition: axe (and a reader) must never meet a half-faded pair.
                  "focus-visible:ring-focus-ring rounded-control flex items-center gap-1.5 px-3 py-1 text-sm outline-none focus-visible:ring-2",
                  "aria-disabled:cursor-not-allowed",
                  id === step
                    ? "bg-primary-subtle text-primary-subtle-fg font-semibold"
                    : locked
                      ? "text-muted"
                      : "text-fg hover:bg-surface-subtle",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-xs",
                    id === step ? "bg-surface" : done ? "bg-success-subtle text-success-subtle-fg" : "bg-bg-subtle",
                  )}
                >
                  {done ? <Icon name="check" size={12} /> : index + 1}
                </span>
                {t(id)}
              </button>
              {locked ? (
                <span id={`studio-step-${id}-locked`} className="sr-only">
                  {t(`locked.${locked}`)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
