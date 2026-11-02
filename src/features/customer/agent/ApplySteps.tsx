import { useTranslations } from "next-intl";

import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

/**
 * Where an applicant is in the two steps of D-466: (1) apply — who you are and how you sell, (2) payout details —
 * tax id, address and bank, needed only before the first payout. Drawn as an ordered list with the current step
 * announced (`aria-current="step"`).
 */
export function ApplySteps({ current }: { current: 1 | 2 }) {
  const t = useTranslations("agent.apply.steps");
  const steps = [
    { n: 1 as const, title: t("one"), body: t("oneBody") },
    { n: 2 as const, title: t("two"), body: t("twoBody") },
  ];
  return (
    <ol aria-label={t("label")} className="grid gap-2 sm:grid-cols-2">
      {steps.map((step) => {
        const done = step.n < current;
        const active = step.n === current;
        return (
          <li
            key={step.n}
            aria-current={active ? "step" : undefined}
            className={cn(
              "rounded-card flex items-start gap-3 border p-3.5",
              active ? "border-primary bg-primary-subtle" : "border-border bg-surface",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums",
                active || done ? "bg-primary text-primary-fg" : "border-border text-muted border",
              )}
            >
              {done ? <Icon name="check" size={14} /> : step.n}
            </span>
            <span className="flex min-w-0 flex-col">
              <b className="text-sm font-semibold">{step.title}</b>
              <span className="text-muted text-xs leading-relaxed">{step.body}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
