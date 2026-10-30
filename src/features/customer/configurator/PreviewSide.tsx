"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import type { Schemas } from "@/lib/api/types";

/** The sizes the API knows on every basis, as `QuoteCalculationDto.dimensions` and the conversion send them. */
export interface PreviewDimensions {
  sizes: Schemas["BasisSizesDto"];
  caliperMm: number | null;
}

export interface PreviewSideProps {
  /** "เบอร์ 00" or "กำหนดเอง". */
  title: string;
  /** From the calculation (or, before the first price, the conversion): `null` shows no sizes. */
  dimensions: PreviewDimensions | null;
  /** Material, printing and print area as the catalogue names them; an empty row is not passed. */
  rows: { label: string; value: string }[];
}

/** The bases in the order a customer reads them: finished, inside, outside, over the creases. */
const BASES = [
  ["product", "product"],
  ["internal", "internal"],
  ["external", "external"],
  ["overCrease", "overCrease"],
] as const;

/**
 * The preview's side panel (prototype `.preview .side`): which size this is, its inside / outside /
 * over-crease dimensions as reference, and the spec in short. Every dimension is the API's — a basis
 * it did not send is not drawn, and the board-thickness note appears only when it sent the caliper.
 */
export function PreviewSide({ title, dimensions, rows }: PreviewSideProps) {
  const t = useTranslations("configurator.preview");
  const format = useFormat();
  const mm = t("mm");
  const sizeText = (size: { l: number; w: number; d: number }) =>
    `${[size.l, size.w, ...(size.d > 0 ? [size.d] : [])].map((value) => format.number(Number(value.toFixed(1)))).join(" × ")} ${mm}`;
  const sizes = BASES.flatMap(([key, label]) => {
    const size = dimensions?.sizes[key];
    return size ? [{ label: t(`dimensions.${label}`), value: sizeText(size) }] : [];
  });
  const derived = Boolean(dimensions?.sizes.external || dimensions?.sizes.overCrease);

  return (
    <div className="border-border bg-surface flex flex-col gap-3 border-t p-4 text-sm min-[1100px]:border-s min-[1100px]:border-t-0">
      <h3 className="m-0 text-sm font-semibold">{title}</h3>
      {sizes.length > 0 ? (
        // Label above value (Project A), the value and its unit kept on one line ("140 × 97.5 × 60 มม.").
        <dl className="m-0 flex flex-col gap-2 tabular-nums">
          {sizes.map((row) => (
            <div key={row.label}>
              <dt className="text-muted text-xs">{row.label}</dt>
              <dd className="m-0 font-medium whitespace-nowrap">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {derived && dimensions?.caliperMm != null ? (
        <p className="text-muted m-0 text-xs leading-snug">
          {t("caliperNote", { mm: format.number(dimensions.caliperMm) })}
        </p>
      ) : null}
      {rows.length > 0 ? (
        <dl className="border-border m-0 flex flex-col gap-2 border-t pt-3">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-muted text-xs">{row.label}</dt>
              <dd className="m-0 break-words">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
