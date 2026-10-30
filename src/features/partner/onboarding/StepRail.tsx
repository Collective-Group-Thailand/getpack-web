import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ONBOARDING_STEP_STATUS } from "@/domain/status";
import { StatusChip } from "@/features/partner/status";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { awaitsSignOff } from "./steps";

type Step = Schemas["OnboardingStepDto"];

/** A step that needs nothing more from the factory: approved, or waived by getpack. */
export const stepDone = (step: Step) => step.status === "approved" || step.status === "waived";

/** The step to work on next: the first one getpack has not closed, else none. */
export const nextStep = (steps: readonly Step[]) => steps.find((step) => !stepDone(step) || awaitsSignOff(step));

/** The step's number as a badge: a tick once it is closed, filled for the one to do next, an outline for the rest. */
function StepNumber({ no, done, next }: { no: number; done: boolean; next: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums",
        done
          ? "bg-primary-subtle text-primary-subtle-fg"
          : next
            ? "bg-primary text-primary-fg"
            : "border-border-strong text-muted border",
      )}
    >
      {done ? <Icon name="check" size={16} /> : no}
    </span>
  );
}

/**
 * The thirteen onboarding steps (D-011) as numbered cards — a two-column grid on the overview, a narrow
 * rail beside a step on a desk (`variant="rail"`). The one to do next has the primary edge; each card
 * opens its step.
 */
export async function StepRail({
  steps,
  current,
  variant = "grid",
}: {
  steps: readonly Step[];
  /** The step being read (the rail marks it). */
  current?: string;
  variant?: "grid" | "rail";
}) {
  const t = await getTranslations("partnerOnboarding");
  const next = nextStep(steps);
  const rail = variant === "rail";
  return (
    <ol className={rail ? "flex flex-col gap-1" : "grid gap-3 md:grid-cols-2"}>
      {steps.map((step, index) => {
        const done = stepDone(step) && !awaitsSignOff(step);
        const isNext = step.step === next?.step;
        const here = step.step === current;
        return (
          <li key={step.step}>
            <Link
              href={`/onboarding/${step.step}`}
              aria-current={here ? "step" : undefined}
              className={cn(
                "focus-visible:ring-focus-ring flex items-center gap-3 outline-none focus-visible:ring-2",
                rail
                  ? cn(
                      "min-h-11 rounded-lg px-2 py-1.5 text-sm",
                      here ? "bg-primary-subtle text-primary-subtle-fg font-semibold" : "hover:bg-surface-subtle",
                    )
                  : cn(
                      "bg-surface hover:border-border-strong rounded-card min-h-20 border p-4 transition-colors",
                      isNext ? "border-primary border-2" : "border-border",
                    ),
              )}
            >
              <StepNumber no={index + 1} done={done} next={isNext} />
              <span className="min-w-0 flex-1">
                <span className={cn("block [overflow-wrap:anywhere] break-keep", !rail && "font-medium")}>
                  {t(`steps.${step.step}.title`)}
                </span>
                {rail ? null : (
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    <StatusChip map={ONBOARDING_STEP_STATUS} value={step.status} />
                    {awaitsSignOff(step) ? (
                      <Badge size="sm" tone="warning" icon="stamp">
                        {t("awaitingSignOff")}
                      </Badge>
                    ) : step.enteredByStaff ? (
                      <Badge size="sm">{t("enteredByGetpack")}</Badge>
                    ) : null}
                  </span>
                )}
              </span>
              {rail ? null : <Icon name="chevron-right" size={20} className="text-muted shrink-0" aria-hidden />}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The bar that keeps the way on in reach (onboarding): sticky at the bottom of the page — above the phone's
 * bottom navigation — on paper with a hairline, so it never covers the field being filled.
 */
export function ContinueBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="z-sticky sticky bottom-[calc(max(4rem,var(--mobile-tab-h))+0.75rem)] md:bottom-4 print:hidden">
      <div className="border-border bg-surface shadow-overlay rounded-card flex flex-wrap items-center justify-between gap-2 border p-2.5 [&_a]:min-h-12 md:[&_a]:min-h-10">
        {children}
      </div>
    </div>
  );
}
