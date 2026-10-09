import { getTranslations } from "next-intl/server";

import { PROPOSAL_LINE_STATUS } from "@/domain/status";
import { StatusChip } from "@/features/partner/status";
import type { Schemas } from "@/lib/api/types";
import { Card } from "@/ui/components/Card";
import { cn } from "@/ui/lib/cn";

import {
  cellText,
  changedKeys,
  columnsOf,
  referenceLookup,
  type PriceComponentDef,
  type PriceReference,
  type Values,
} from "./values";

type Line = Schemas["PriceProposalLineDto"];

/** The text a line is known by — its component and identifying columns — for lists and dialogs. */
export async function lineLabeller(definitions: PriceComponentDef[], references: PriceReference[]) {
  const tComponents = await getTranslations("partnerPrices.components");
  const tColumns = await getTranslations("partnerPrices.columns");
  const t = await getTranslations("partnerPrices.editor");
  const referenceName = referenceLookup(references);
  const labels = { yes: t("yes"), no: t("no"), open: t("open") };
  const label = (key: string) => (tColumns.has(key) ? tColumns(key) : key);
  const valueKeys = new Set(definitions.flatMap((definition) => definition.values.map((column) => column.key)));
  const text = (component: Schemas["PriceComponent"], values: Values | null, part: "dimensions" | "values" | "all") =>
    columnsOf(definitions, component)
      [part].map(
        (column) =>
          `${label(column.key)} ${cellText(values?.[column.key], column, referenceName, labels, valueKeys.has(column.key))}`,
      )
      .join(" · ");
  return {
    title: (line: Pick<Line, "component" | "currentValues" | "proposedValues">) => {
      const dims = text(line.component, (line.proposedValues ?? line.currentValues) as Values | null, "dimensions");
      return dims ? `${tComponents(line.component)} · ${dims}` : tComponents(line.component);
    },
    values: (component: Schemas["PriceComponent"], values: Values | null) => text(component, values, "values"),
    cell: (column: { key: string; type: Schemas["PriceColumnType"] }, value: unknown) =>
      cellText(value, column, referenceName, labels, valueKeys.has(column.key)),
    column: label,
  };
}

/**
 * The lines of a proposal or rate card: what is in force now, what is proposed (the columns that
 * change marked), Packio's counter where there is one, and the decision so far (D-040).
 */
export async function LineList({
  lines,
  definitions,
  references,
  showDecision = true,
}: {
  lines: Line[];
  definitions: PriceComponentDef[];
  references: PriceReference[];
  showDecision?: boolean;
}) {
  const t = await getTranslations("partnerPrices.lines");
  const label = await lineLabeller(definitions, references);
  if (!lines.length) return <p className="text-muted">{t("empty")}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {lines.map((line) => {
        const columns = columnsOf(definitions, line.component).values;
        const changed = changedKeys(line.currentValues as Values | null, line.proposedValues as Values | null);
        return (
          <li key={line.id}>
            <Card padding="md" className="flex flex-col gap-2">
              <div className="flex flex-wrap items-start gap-2">
                <p className="min-w-0 flex-1 font-medium">{label.title(line)}</p>
                {showDecision ? <StatusChip map={PROPOSAL_LINE_STATUS} value={line.decision} /> : null}
              </div>
              <p className="text-muted text-sm">{t(`actions.${line.action}`)}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm tabular-nums">
                {columns.map((column) => (
                  <div key={column.key} className="contents">
                    <dt className="text-muted">{label.column(column.key)}</dt>
                    <dd className={cn(changed.has(column.key) && line.action === "change" && "font-semibold")}>
                      {line.currentValues && line.action !== "add" ? (
                        <>
                          {label.cell(column, (line.currentValues as Values)[column.key])}
                          {line.action === "change" && changed.has(column.key) ? (
                            <>
                              {" → "}
                              {label.cell(column, (line.proposedValues as Values | null)?.[column.key])}
                            </>
                          ) : null}
                        </>
                      ) : (
                        label.cell(column, (line.proposedValues as Values | null)?.[column.key])
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              {line.counterValues ? (
                <p className="bg-warning-subtle text-warning-subtle-fg rounded-md p-2 text-sm">
                  {t("counter", { values: label.values(line.component, line.counterValues as Values) })}
                </p>
              ) : null}
              {line.comment ? <p className="text-sm">{t("comment", { comment: line.comment })}</p> : null}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
