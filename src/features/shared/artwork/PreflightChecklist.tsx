"use client";

import { useTranslations } from "next-intl";

import type { Schemas } from "@/lib/api/types";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

type CheckResult = Schemas["PreflightCheckResultDto"];
type Check = Schemas["PreflightCheck"];

/** The five checks every file is held to, in the order a person reads a file (UX audit, preflight). */
export const CORE_CHECKS: readonly Check[] = [
  "size_mismatch",
  "missing_bleed",
  "rgb_colour",
  "fonts_not_embedded",
  "low_resolution",
];

export type ChecklistState = "pass" | "fail" | "warn" | "unknown";

export interface ChecklistRow {
  check: Check;
  state: ChecklistState;
  /** The API's own sentence for the first finding, in the reader's language. */
  message: string | null;
  page: number | null;
}

/**
 * The preflight report as a checklist: the five core checks always, each passed, failed (a blocking
 * finding), a warning or not evaluated; then any other check that found something. The findings are
 * the API's (D-070); this only lays them out.
 */
export function checklistRows(results: readonly CheckResult[], locale: string): ChecklistRow[] {
  const rowOf = (check: Check): ChecklistRow => {
    const mine = results.filter((result) => result.check === check);
    const failing = mine.find((result) => result.outcome === "fail");
    const state: ChecklistState = failing
      ? failing.severity === "block"
        ? "fail"
        : "warn"
      : mine.some((result) => result.outcome === "pass")
        ? "pass"
        : "unknown";
    return {
      check,
      state,
      message: failing ? (locale === "en" ? (failing.messageEn ?? failing.messageTh) : failing.messageTh) : null,
      page: failing?.page ?? null,
    };
  };
  const others = [...new Set(results.map((result) => result.check))].filter(
    (check) =>
      !CORE_CHECKS.includes(check) && results.some((result) => result.check === check && result.outcome === "fail"),
  );
  return [...CORE_CHECKS.map(rowOf), ...others.map(rowOf)];
}

/** What to tell the customer when the file goes back: one line per failed check, from its finding. */
export function requestNewFileMessage(rows: readonly ChecklistRow[], label: (check: Check) => string): string {
  return rows
    .filter((row) => row.state === "fail" || row.state === "warn")
    .map((row) => `• ${label(row.check)}${row.message ? ` — ${row.message}` : ""}`)
    .join("\n");
}

const MARK: Record<ChecklistState, { icon: "check" | "ban" | "warning" | "help"; tone: string }> = {
  pass: { icon: "check", tone: "bg-success-subtle text-success-subtle-fg" },
  fail: { icon: "ban", tone: "bg-danger-subtle text-danger-subtle-fg" },
  warn: { icon: "warning", tone: "bg-warning-subtle text-warning-subtle-fg" },
  unknown: { icon: "help", tone: "bg-surface-subtle text-muted" },
};

export function PreflightChecklist({
  rows,
  labelOf,
}: {
  rows: readonly ChecklistRow[];
  labelOf: (check: Check) => string;
}) {
  const t = useTranslations("common.preflight");
  return (
    <ul className="divide-border border-border rounded-control divide-y border">
      {rows.map((row) => (
        <li key={row.check} className="flex items-start gap-3 px-3.5 py-3 text-sm">
          <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full", MARK[row.state].tone)}>
            <Icon name={MARK[row.state].icon} size={14} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">{labelOf(row.check)}</span>
              <span className="text-muted text-xs">
                {t(`states.${row.state}`)}
                {row.page ? ` · ${t("page", { page: row.page })}` : null}
              </span>
            </p>
            {row.message ? <p className="text-muted mt-0.5">{row.message}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
