import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import { OPS_SIGNAL_STATUS } from "@/domain/status";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { StatStrip } from "@/ui/components/RowList";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export type OpsSignal = Schemas["OpsSignalDto"];

/** The unit a signal is measured in, where its key names one; every other signal is a count of what its label says. */
export function signalUnit(key: string): "minutes" | "hours" | null {
  if (key.endsWith("_minutes")) return "minutes";
  if (key.endsWith("_hours")) return "hours";
  return null;
}

/** Where a person goes to work a signal down: the desk whose queue it counts. */
const DESK: Readonly<Record<string, string>> = {
  outbox_dead_letters: "/outbox",
  outbox_backlog_minutes: "/outbox",
  acceptance_overdue: "/production",
  production_at_risk: "/production?atRisk=true",
  rfq_first_response_overdue: "/rfq?queue=new",
  approvals_overdue: "/approvals",
  slip_verification_wait_hours: "/finance/slips",
  claim_response_overdue: "/claims",
  claim_decision_overdue: "/claims",
  conversation_first_response_overdue: "/inbox?sla=waiting",
  payout_item_failures_7d: "/finance/payouts/exceptions",
};

const ORDER = { alert: 0, unknown: 1, ok: 2 } as const;

/**
 * The launch-monitoring signals (`admin.ops.signals`, getpack-api B6.3, D-113): a strip of how many are over their
 * threshold, then every signal — the ones over first — with its value and threshold in the signal's unit, its state
 * as an icon and a word (never colour alone), and a way to the desk that works it down.
 *
 * Read-only on purpose: thresholds are a setting and the alerts are raised by the API's worker, so this screen only
 * shows where each signal stands. A `null` value means the API could not read the source, which is itself worth
 * seeing.
 */
export function OpsSignals({ signals }: { signals: readonly OpsSignal[] }) {
  const t = useTranslations("platform.ops");
  const tStatus = useTranslations("status");
  const format = useFormatter();

  if (signals.length === 0)
    return (
      <EmptyState
        icon="activity"
        title={t("empty")}
        action={
          <Button asChild variant="secondary" iconEnd="arrow-right">
            <Link href="/outbox">{t("openOutbox")}</Link>
          </Button>
        }
      />
    );

  // A signal the API sends before this app has words for it reads as its key without the prefix, not a message path.
  const label = (key: string) => (t.has(`signals.${key}`) ? t(`signals.${key}`) : key.replaceAll("_", " "));
  const amount = (key: string, value: number) => {
    const unit = signalUnit(key);
    return unit ? t(`units.${unit}`, { value: format.number(value) }) : format.number(value);
  };
  const sorted = [...signals].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const count = (status: OpsSignal["status"]) => signals.filter((signal) => signal.status === status).length;

  return (
    <div className="flex flex-col gap-5">
      <StatStrip
        label={t("summary")}
        items={(["alert", "unknown", "ok"] as const).map((status) => ({
          key: status,
          label: tStatus(OPS_SIGNAL_STATUS[status].labelKey),
          value: format.number(count(status)),
          tone:
            status === "alert" && count(status) > 0
              ? "danger"
              : status === "unknown" && count(status) > 0
                ? "warning"
                : "neutral",
        }))}
      />
      <Card padding="none" className="relative hidden overflow-x-auto md:block">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">{t("title")}</caption>
          <thead>
            <tr className="text-muted border-border bg-surface-subtle border-b text-xs">
              <th scope="col" className="px-4 py-2.5 text-start font-medium">
                {t("columns.signal")}
              </th>
              <th scope="col" className="px-4 py-2.5 text-start font-medium">
                {t("columns.status")}
              </th>
              <th scope="col" className="px-4 py-2.5 text-end font-medium">
                {t("columns.value")}
              </th>
              <th scope="col" className="px-4 py-2.5 text-end font-medium">
                {t("columns.threshold")}
              </th>
              <th scope="col" className="w-12 px-2 py-2.5">
                <span className="sr-only">{t("columns.desk")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((signal) => {
              const meta = OPS_SIGNAL_STATUS[signal.status];
              const desk = DESK[signal.key];
              return (
                <tr key={signal.key} className="border-border border-b last:border-0" data-signal={signal.key}>
                  <th scope="row" className="px-4 py-3 text-start font-normal">
                    <span className={cn(signal.status === "alert" && "font-medium")}>{label(signal.key)}</span>
                  </th>
                  <td className="px-4 py-3">
                    <StatusBadge meta={meta} label={tStatus(meta.labelKey)} />
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-end tabular-nums",
                      signal.status === "alert" ? "text-danger-subtle-fg font-semibold" : "font-medium",
                    )}
                  >
                    {signal.value === null ? (
                      <span className="text-muted font-normal">{t("unread")}</span>
                    ) : (
                      amount(signal.key, signal.value)
                    )}
                  </td>
                  <td className="text-muted px-4 py-3 text-end tabular-nums">
                    {signal.threshold === null ? t("noThreshold") : amount(signal.key, signal.threshold)}
                  </td>
                  <td className="px-2 py-3 text-end">
                    {desk ? (
                      <Link
                        href={desk}
                        className="text-muted hover:text-fg hover:bg-surface-subtle focus-visible:ring-focus-ring inline-grid size-9 place-items-center rounded-lg outline-none focus-visible:ring-2"
                        aria-label={t("openDesk", { signal: label(signal.key) })}
                      >
                        <Icon name="chevron-right" size={18} aria-hidden="true" />
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      {/* On a phone each signal is one row: what it is, then its state, value and threshold on one line. */}
      <ul
        className="border-border bg-surface divide-border rounded-card divide-y border md:hidden"
        aria-label={t("title")}
      >
        {sorted.map((signal) => {
          const meta = OPS_SIGNAL_STATUS[signal.status];
          const desk = DESK[signal.key];
          const body = (
            <>
              <span className="min-w-0 flex-1">
                <span className={cn("block", signal.status === "alert" && "font-medium")}>{label(signal.key)}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <StatusBadge meta={meta} label={tStatus(meta.labelKey)} />
                  <span
                    className={cn(
                      "tabular-nums",
                      signal.status === "alert" ? "text-danger-subtle-fg font-semibold" : "font-medium",
                    )}
                  >
                    {signal.value === null ? t("unread") : amount(signal.key, signal.value)}
                  </span>
                  <span className="text-muted tabular-nums">
                    {t("columns.threshold")}{" "}
                    {signal.threshold === null ? t("noThreshold") : amount(signal.key, signal.threshold)}
                  </span>
                </span>
              </span>
              {desk ? <Icon name="chevron-right" size={18} className="text-muted shrink-0" aria-hidden="true" /> : null}
            </>
          );
          return (
            <li key={signal.key}>
              {desk ? (
                <Link href={desk} className="hover:bg-surface-subtle flex items-center gap-3 px-4 py-3">
                  {body}
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
