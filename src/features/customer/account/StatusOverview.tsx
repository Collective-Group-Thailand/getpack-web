import { getTranslations } from "next-intl/server";

import type { StatusMeta } from "@/domain/status";
import { getFormat } from "@/features/shared/format/server";

import { TabBar } from "./AccountTabs";
import { customerStatusLabel } from "./status-label";
import { SummaryCards } from "./SummaryCards";

type Row = { status: string };

/** The rows a status tab shows: the one asked for in the address when it is among them, else all. */
export function filterByStatus<T extends Row>(rows: readonly T[], wanted: string | undefined) {
  const current = wanted && rows.some((row) => row.status === wanted) ? wanted : undefined;
  return { current, rows: current ? rows.filter((row) => row.status === current) : [...rows] };
}

/**
 * The counts on top of an account list (Project B3): one card per status that matters on this page, the one
 * waiting on the customer on the pale tint. Counts only — nothing is added up.
 */
export async function StatusSummary<T extends string>({
  rows,
  map,
  statuses,
  highlight,
  className,
}: {
  rows: readonly Row[];
  map: Record<T, StatusMeta>;
  statuses: readonly T[];
  /** The status that asks something of the customer. */
  highlight?: T;
  className?: string;
}) {
  const [tStatus, format] = await Promise.all([getTranslations("status"), getFormat()]);
  return (
    <SummaryCards
      className={className}
      columns={statuses.length >= 4 ? 4 : statuses.length === 3 ? 3 : 2}
      items={statuses.map((status) => ({
        key: status,
        label: customerStatusLabel(tStatus, map, status),
        value: format.number(rows.filter((row) => row.status === status).length),
        icon: map[status].icon,
        highlight: status === highlight,
      }))}
    />
  );
}

/** The statuses present in a list as tabs with their counts (`?status=`), "ทั้งหมด" first. Nothing when only one. */
export async function StatusTabs<T extends string>({
  rows,
  map,
  basePath,
  current,
  label,
  className,
}: {
  rows: readonly Row[];
  map: Record<T, StatusMeta>;
  basePath: string;
  current: string | undefined;
  /** What the tabs choose between, for the screen reader. */
  label: string;
  className?: string;
}) {
  const [t, tStatus] = await Promise.all([getTranslations("account.tabs"), getTranslations("status")]);
  const present = (Object.keys(map) as T[]).filter((status) => rows.some((row) => row.status === status));
  if (present.length < 2) return null;
  return (
    <TabBar
      className={className}
      label={label}
      items={[
        { key: "all", href: basePath, label: t("all"), current: !current, count: rows.length },
        ...present.map((status) => ({
          key: status,
          href: `${basePath}?status=${status}`,
          label: customerStatusLabel(tStatus, map, status),
          current: current === status,
          count: rows.filter((row) => row.status === status).length,
        })),
      ]}
    />
  );
}
