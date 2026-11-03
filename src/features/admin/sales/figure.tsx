"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { FigureTip } from "@/ui/components/FigureTip";

/**
 * A sales-desk figure with its explanation (D-470 "every number has a tooltip"): the definition and formula come from
 * `sales.figures.{key}` in the message files, the source names the record (and links it), the as-of time is the
 * API's. One component so every screen explains a number the same way.
 */
export function Figure({
  name,
  children,
  source,
  asOf,
  values,
  className,
}: {
  /** The key under `sales.figures` (definition + formula). */
  name: string;
  children: React.ReactNode;
  source?: { label: React.ReactNode; href?: string | null };
  asOf?: string | null;
  values?: Record<string, string | number>;
  className?: string;
}) {
  const t = useTranslations("sales.figures");
  const tTip = useTranslations("sales.tip");
  const format = useFormat();
  return (
    <FigureTip
      definition={t(`${name}.definition`, values)}
      formula={t.has(`${name}.formula`) ? t(`${name}.formula`, values) : undefined}
      source={source}
      asOf={asOf ? format.dateTime(asOf) : undefined}
      labels={{ formula: tTip("formula"), source: tTip("source"), asOf: tTip("asOf") }}
      className={className}
    >
      {children}
    </FigureTip>
  );
}

/** The plain-text explanation of a figure, for places that already own a tooltip (a chart row). */
export function useFigureText() {
  const t = useTranslations("sales.figures");
  const tTip = useTranslations("sales.tip");
  const format = useFormat();
  return function explain(name: string, extra: { source?: string; asOf?: string | null } = {}) {
    return (
      <span className="flex flex-col gap-0.5">
        <span>{t(`${name}.definition`)}</span>
        {t.has(`${name}.formula`) ? (
          <span>
            <span className="opacity-75">{tTip("formula")}: </span>
            {t(`${name}.formula`)}
          </span>
        ) : null}
        {extra.source ? (
          <span>
            <span className="opacity-75">{tTip("source")}: </span>
            {extra.source}
          </span>
        ) : null}
        {extra.asOf ? (
          <span className="opacity-75">
            {tTip("asOf")} {format.dateTime(extra.asOf)}
          </span>
        ) : null}
      </span>
    );
  };
}
