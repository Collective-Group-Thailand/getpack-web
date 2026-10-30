import { MobileActionBar } from "@/ui/components/MobileActionBar";
import { cn } from "@/ui/lib/cn";

/**
 * The frame of a partner form (an ERP document, a record): the numbered sections on the left and, on a desk, a
 * summary panel on the right that stays in view while the sections scroll — what the form adds up to and the one
 * button that saves it. Below `lg` the panel follows the sections; on a phone its button moves into the bottom
 * action bar. Plain markup, so client forms and server pages can both use it.
 */
export function FormColumns({ aside, children }: { aside: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20">{aside}</aside>
    </div>
  );
}

/**
 * The summary panel of `FormColumns`: a title, what the form adds up to so far (rows, an estimate), and the submit
 * action. The action is drawn twice — in the panel from a tablet up, in the phone's bottom bar below that — so it
 * is always one thumb away; only one of the two is ever visible.
 */
export function FormSummary({
  title,
  children,
  action,
  className,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  action: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      <section className={cn("rounded-card border-border bg-surface flex flex-col gap-4 border p-4 sm:p-5", className)}>
        <h2 className="text-base font-semibold">{title}</h2>
        {children}
        <div data-fill="row" className="hidden flex-col gap-2 md:flex">
          {action}
        </div>
      </section>
      {/* Above the partner bottom tab bar (64 px), not the storefront's. */}
      <MobileActionBar className="bottom-[max(4rem,var(--mobile-tab-h))]">{action}</MobileActionBar>
    </>
  );
}

/** One fact of a form's summary: a label and what has been picked or typed so far (a dash until then). */
export function SummaryRows({ rows }: { rows: { key: string; label: React.ReactNode; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-2 text-sm">
      {rows.map((row) => (
        <div key={row.key} className="contents">
          <dt className="text-muted">{row.label}</dt>
          <dd className="text-end [overflow-wrap:anywhere] break-keep">{row.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The save of a long settings form that has no summary column: a bar that stays at the bottom of the view while the
 * sections scroll (a desk), or the phone's bottom action bar — so the save is never a scroll away. `note` says what
 * the save covers or why it is off.
 */
export function StickySave({ note, children }: { note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <div className="border-border bg-surface shadow-overlay rounded-card sticky bottom-4 z-10 hidden items-center justify-between gap-4 border px-4 py-3 md:flex">
        <p className="text-muted min-w-0 text-sm text-pretty">{note}</p>
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      </div>
      <MobileActionBar className="bottom-[max(4rem,var(--mobile-tab-h))]">{children}</MobileActionBar>
    </>
  );
}
