"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { shiftDay, shiftMonth } from "@/lib/period";
import { Button } from "@/ui/components/Button";
import { DateField } from "@/ui/components/DateField";
import { IconButton } from "@/ui/components/IconButton";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis } from "../console/api";
import { QueueTabs } from "../console/queues";
import type { ListResource } from "../console/resource";

/** A month (YYYY-MM) as the reader's calendar writes it: "ต.ค. 2569". */
function useMonthLabel() {
  const format = useFormat();
  return (month: string) => (month ? format.date(`${month}-01`, { style: "month" }) : "");
}

/** A month or a day picked in place: the native field, the Thai label at rest (`DateField`). */
export function PeriodField({
  type,
  label,
  value,
  onChange,
  min,
  max,
  className,
}: {
  type: "month" | "date";
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  className?: string;
}) {
  const t = useTranslations("console.filters");
  const format = useFormat();
  const month = useMonthLabel();
  const display = value
    ? type === "month"
      ? month(value)
      : format.date(value)
    : type === "month"
      ? t("pickMonth")
      : t("pickDate");
  return (
    <label className={cn("flex min-w-0 items-center gap-2", className)}>
      <span className="text-muted min-w-12 shrink-0 text-sm sm:min-w-0">{label}</span>
      <DateField
        type={type}
        value={value}
        min={min}
        max={max}
        display={display}
        className={type === "month" ? "w-36" : "w-40"}
        onChange={(event) => event.target.value && onChange(event.target.value)}
      />
    </label>
  );
}

/**
 * The period of a money report, in the report's one toolbar: the month range (or the day a balance is taken), the step
 * to the period before and after (the whole range moves by a month, or the day by a day), then the report's own
 * controls and its tools at the far end. The period lives in the address, so a figure can be linked to.
 */
export function PeriodBar({
  range,
  day,
  month,
  onChange,
  controls,
  tools,
}: {
  range?: { from: string; to: string; fromLabel: string; toLabel: string };
  day?: { value: string; label: string; max?: string };
  /** One month (`period` in the address). */
  month?: { value: string; label: string };
  onChange: (patch: Record<string, string>) => void;
  /** More of the report's parameters (a dimension, a switch), after the period. */
  controls?: React.ReactNode;
  /** The report's tools (export), at the end of the row. */
  tools?: React.ReactNode;
}) {
  const t = useTranslations("console.filters");
  const step = (by: number) => {
    if (range) onChange({ from: shiftMonth(range.from, by), to: shiftMonth(range.to, by) });
    else if (day) onChange({ asOf: shiftDay(day.value, by) });
    else if (month) onChange({ period: shiftMonth(month.value, by) });
  };
  const atEnd = day?.max !== undefined && day.value >= day.max;
  return (
    <div
      role="toolbar"
      aria-label={t("period")}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        {range ? (
          <>
            <PeriodField
              type="month"
              label={range.fromLabel}
              value={range.from}
              max={range.to}
              onChange={(from) => onChange({ from })}
            />
            <PeriodField
              type="month"
              label={range.toLabel}
              value={range.to}
              min={range.from}
              onChange={(to) => onChange({ to })}
            />
          </>
        ) : day ? (
          <PeriodField
            type="date"
            label={day.label}
            value={day.value}
            max={day.max}
            onChange={(asOf) => onChange({ asOf })}
          />
        ) : month ? (
          <PeriodField
            type="month"
            label={month.label}
            value={month.value}
            onChange={(period) => onChange({ period })}
          />
        ) : null}
        <div className="flex items-center gap-1.5">
          <IconButton name="chevron-left" variant="secondary" label={t("prevPeriod")} onClick={() => step(-1)} />
          <IconButton
            name="chevron-right"
            variant="secondary"
            label={t("nextPeriod")}
            onClick={() => step(1)}
            disabled={atEnd}
          />
        </div>
        {controls}
      </div>
      {tools ? <div className="flex flex-wrap items-center gap-2">{tools}</div> : null}
    </div>
  );
}

/**
 * A list's statuses as its counted views (the segmented tabs every desk list shares): "ทั้งหมด" first, then each
 * status, each count the rows that tab opens (the list's own `meta.total` with this page's search and filters).
 * Statuses with nothing in them stay out unless open.
 */
export function StatusViews({
  resource,
  label,
  allLabel,
  statuses,
  param = "status",
  all = true,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resource: ListResource<any>;
  label: string;
  allLabel?: string;
  statuses: readonly { value: string; label: string }[];
  param?: string;
  /** Whether "everything" is a view (a list whose default is a queue has none). */
  all?: boolean;
}) {
  const t = useTranslations("console.filters");
  return (
    <QueueTabs
      label={label}
      param={param}
      hideEmpty
      countFrom={resource}
      tabs={[...(all ? [{ value: null, label: allLabel ?? t("any") }] : []), ...statuses]}
    />
  );
}

/**
 * A finance document drawn as the paper it is (a tax invoice, a purchase order, a billing statement): its kind and
 * number at the head with the dates opposite, the two parties side by side, the lines, and the totals right-aligned
 * under them — the result over a double rule. Every figure arrives formatted from the API's amounts.
 */
export function DocumentSheet({
  kind,
  number,
  facts,
  parties,
  children,
  totals,
  footer,
}: {
  kind: React.ReactNode;
  number: React.ReactNode;
  /** The dates and references printed at the head, opposite the number. */
  facts?: readonly { key: string; label: React.ReactNode; value: React.ReactNode }[];
  parties?: readonly { key: string; label: React.ReactNode; body: React.ReactNode }[];
  /** The lines (a table). */
  children?: React.ReactNode;
  totals?: readonly {
    key: string;
    label: React.ReactNode;
    amount: React.ReactNode;
    strong?: boolean;
    result?: boolean;
  }[];
  footer?: React.ReactNode;
}) {
  return (
    <article className="border-border bg-surface rounded-xl border">
      <header className="border-border flex flex-wrap items-start justify-between gap-x-8 gap-y-3 border-b px-4 py-4 sm:px-6 sm:py-5">
        <div className="min-w-0">
          <p className="text-muted text-sm">{kind}</p>
          <p className="text-xl font-semibold [overflow-wrap:anywhere] tabular-nums">{number}</p>
        </div>
        {facts?.length ? (
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
            {facts.map((fact) => (
              <div key={fact.key} className="contents">
                <dt className="text-muted">{fact.label}</dt>
                <dd className="text-end tabular-nums">{fact.value || "—"}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </header>
      {parties?.length ? (
        <div className="border-border grid gap-x-8 gap-y-4 border-b px-4 py-4 sm:grid-cols-2 sm:px-6">
          {parties.map((party) => (
            <section key={party.key} className="min-w-0">
              <h3 className="text-muted mb-1.5 text-sm font-medium">{party.label}</h3>
              <div className="text-sm">{party.body}</div>
            </section>
          ))}
        </div>
      ) : null}
      {children ? <div className="px-4 py-4 sm:px-6">{children}</div> : null}
      {totals?.length ? (
        <dl className="ms-auto grid w-full max-w-sm grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1.5 px-4 pb-5 text-sm sm:px-6">
          {totals.map((row) => (
            <div key={row.key} className="contents">
              <dt className={cn(row.strong || row.result ? "font-medium" : "text-muted", row.result && "pt-1.5")}>
                {row.label}
              </dt>
              <dd
                className={cn(
                  "text-end whitespace-nowrap tabular-nums",
                  (row.strong || row.result) && "font-semibold",
                  row.result && "border-border-strong border-t border-b-[3px] border-double pt-1.5 pb-0.5",
                )}
              >
                {row.amount}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {footer ? <footer className="border-border border-t px-4 py-3 sm:px-6">{footer}</footer> : null}
    </article>
  );
}

/**
 * Who asked and who decided, with when — the maker-checker trail of a record that went through an approval (a payout
 * run, a manual journal, a refund), read from the approval itself, for the record's panel.
 */
export function ApprovalTrail({ requestId }: { requestId: string }) {
  const t = useTranslations("approvals");
  const approval = useQuery({
    queryKey: queryKeys.detail("admin", "approval", requestId),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/approvals/{requestId}", { params: { path: { requestId } } }))
        .data!,
  });
  const data = approval.data;
  if (!data) return null;
  const rows = [
    { key: "asked", what: t("requester"), who: data.requester.displayName, at: data.createdAt },
    ...data.actions.map((action, index) => ({
      key: `a${index}`,
      what: t.has(`actionKinds.${action.action}`) ? t(`actionKinds.${action.action}`) : action.action,
      who: action.onBehalfOf
        ? t("onBehalfOf", { name: action.actor.displayName, for: action.onBehalfOf.displayName })
        : action.actor.displayName,
      at: action.at,
    })),
  ];
  return (
    <section aria-label={t("history")} className="border-border flex flex-col gap-2 border-t pt-3">
      <ol className="flex flex-col gap-2 text-sm">
        {rows.map((row) => (
          <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3">
            <span className="min-w-0">
              <span className="text-muted">{row.what}</span> <span className="font-medium">{row.who}</span>
            </span>
            <span className="text-muted text-end text-xs tabular-nums">
              <When at={row.at} absoluteOnly />
            </span>
          </li>
        ))}
      </ol>
      <Link href={`/approvals/${requestId}`} className="text-primary text-sm hover:underline">
        {t("open")}
      </Link>
    </section>
  );
}

/**
 * A date or month field of a finance form or toolbar: the native control with the Thai date (Buddhist year) shown at
 * rest instead of the browser's "mm/dd/yyyy" / "January 2026". The value stays ISO.
 */
export function FinanceDateField({
  type = "date",
  value,
  ...props
}: Omit<React.ComponentProps<typeof DateField>, "display"> & { value: string | undefined }) {
  const t = useTranslations("console.filters");
  const format = useFormat();
  const display = value
    ? type === "month"
      ? format.date(`${value}-01`, { style: "month" })
      : format.date(value)
    : type === "month"
      ? t("pickMonth")
      : t("pickDate");
  return <DateField type={type} value={value} display={display} {...props} />;
}

/**
 * The way out of an empty finance list: the desk page where its rows come from, named by the finance menu's own words
 * (`finance.<area>.nav.<key>` or `finance.nav.items.<key>`).
 */
export function EmptyLink({ href, label }: { href: string; label: string }) {
  const t = useTranslations("finance");
  return (
    <Button asChild variant="secondary">
      <Link href={href}>{t(label as never)}</Link>
    </Button>
  );
}
