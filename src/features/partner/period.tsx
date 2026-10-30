import Link from "next/link";

import { Button } from "@/ui/components/Button";
import { Input } from "@/ui/components/Input";
import { Icon } from "@/ui/icons";

type Step = { href: string; label: string };

/** A square step link either side of the period (the month before, the month after). */
function StepLink({ href, label, icon }: Step & { icon: "chevron-left" | "chevron-right" }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="border-border bg-surface text-muted hover:bg-surface-subtle hover:text-fg focus-visible:ring-focus-ring rounded-control grid size-11 shrink-0 place-items-center border outline-none focus-visible:ring-2 md:size-10"
    >
      <Icon name={icon} size={18} aria-hidden />
    </Link>
  );
}

/**
 * The period of a money report (a tax month, a statement's dates) as one compact control for the list's toolbar:
 * the field(s) with a short label beside them, the step links to the period before and after, and a plain submit.
 * A GET form, so the period lives in the address and the back button keeps it.
 */
export function PeriodPicker({
  action,
  label,
  hidden = {},
  fields,
  submit,
  prev,
  next,
}: {
  action: string;
  /** What the control is, for a screen reader (the form's name). */
  label: string;
  /** The rest of the page's query (the tab, the form) carried along. */
  hidden?: Record<string, string | undefined>;
  fields: { name: string; label: string; value: string; type: "date" | "month" | "text" }[];
  submit: string;
  prev?: Step;
  next?: Step;
}) {
  return (
    <form action={action} aria-label={label} className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-2">
      {Object.entries(hidden).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        {fields.map((field) => (
          <label key={field.name} className="flex min-w-0 items-center gap-2">
            <span className="text-muted shrink-0 text-sm">{field.label}</span>
            <Input
              type={field.type}
              name={field.name}
              defaultValue={field.value}
              className={field.type === "text" ? "w-28" : field.type === "month" ? "w-44" : "w-40"}
            />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {prev ? <StepLink {...prev} icon="chevron-left" /> : null}
        {next ? <StepLink {...next} icon="chevron-right" /> : null}
        <Button type="submit" variant="secondary">
          {submit}
        </Button>
      </div>
    </form>
  );
}

/** The step labels as words only: the copy may carry its own arrow glyph ("‹ เดือนก่อน"), the button draws one. */
export const stepLabel = (copy: string) => copy.replace(/[‹›«»←→]/g, "").trim();

/** This month in Bangkok (`YYYY-MM`) — the default period of a monthly report. */
export const bangkokMonth = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);

/** A `YYYY-MM` month `by` months away. */
export const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
};

/** A `YYYY-MM-DD` day `by` days away. */
export const shiftDay = (day: string, by: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + by * 86_400_000).toISOString().slice(0, 10);
