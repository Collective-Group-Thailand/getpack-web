import { useFormatter, useTranslations } from "next-intl";

import { OPS_SIGNAL_STATUS } from "@/domain/status";
import type { Schemas } from "@/lib/api/types";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { StatusBadge } from "@/ui/components/StatusBadge";

export type OpsSignal = Schemas["OpsSignalDto"];

/**
 * The launch-monitoring signals (`admin.ops.signals`, getpack-api B6.3, D-113), in the API's order.
 *
 * Read-only on purpose: thresholds are the `ops.alert_thresholds` setting and the alerts are
 * raised by the API's worker, so this screen only shows where each signal stands. A `null`
 * value means the API could not read the source, which is itself worth seeing.
 */
export function OpsSignals({ signals }: { signals: readonly OpsSignal[] }) {
  const t = useTranslations("platform.ops");
  const tStatus = useTranslations("status");
  const format = useFormatter();

  if (signals.length === 0) return <EmptyState title={t("empty")} />;

  return (
    <Card padding="none" className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted border-border border-b text-xs">
            <th scope="col" className="px-4 py-2 text-start font-medium">
              {t("columns.signal")}
            </th>
            <th scope="col" className="px-4 py-2 text-end font-medium">
              {t("columns.value")}
            </th>
            <th scope="col" className="px-4 py-2 text-end font-medium">
              {t("columns.threshold")}
            </th>
            <th scope="col" className="px-4 py-2 text-start font-medium">
              {t("columns.status")}
            </th>
          </tr>
        </thead>
        <tbody>
          {signals.map((signal) => {
            const meta = OPS_SIGNAL_STATUS[signal.status];
            return (
              <tr key={signal.key} className="border-border border-b last:border-0" data-signal={signal.key}>
                <th scope="row" className="px-4 py-3 text-start font-normal">
                  {t(`signals.${signal.key}`)}
                </th>
                <td className="px-4 py-3 text-end tabular-nums">
                  {signal.value === null ? (
                    <span className="text-muted">{t("unread")}</span>
                  ) : (
                    format.number(signal.value)
                  )}
                </td>
                <td className="text-muted px-4 py-3 text-end tabular-nums">
                  {signal.threshold === null ? t("noThreshold") : format.number(signal.threshold)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge meta={meta} label={tStatus(meta.labelKey)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
