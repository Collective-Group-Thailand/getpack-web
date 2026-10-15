"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";

import { sortRates } from "./rates";

export interface RateRow {
  id?: string;
  zoneCode: string;
  zoneName?: string;
  postcode: string | null;
  weightMinG: number;
  weightMaxG: number | null;
  volumeMinCm3: number | null;
  volumeMaxCm3: number | null;
  amount: string;
  perExtraKg: string | null;
}

/** "1–3 kg", "from 20 kg" — a half-open band read the way staff say it. */
export function useBand() {
  const t = useTranslations("shipping.band");
  const format = useFormat();
  return {
    weight: (min: number, max: number | null) =>
      max === null
        ? t("weightFrom", { min: format.number(min / 1000) })
        : t("weight", { min: format.number(min / 1000), max: format.number(max / 1000) }),
    volume: (min: number | null, max: number | null) =>
      min === null && max === null
        ? t("anyVolume")
        : max === null
          ? t("volumeFrom", { min: format.number(min ?? 0) })
          : t("volume", { min: format.number(min ?? 0), max: format.number(max) }),
  };
}

/** A version's lines, by zone then band (D-013); amounts VAT-exclusive. */
export function RatesTable<T extends RateRow>({
  rows,
  caption,
  amountLabel,
  extraColumns = [],
}: {
  rows: readonly T[];
  caption: string;
  amountLabel: string;
  extraColumns?: DataTableColumn<T>[];
}) {
  const t = useTranslations("shipping.rates");
  const format = useFormat();
  const band = useBand();
  const columns: DataTableColumn<T>[] = [
    {
      id: "zone",
      header: t("zone"),
      cell: (row) => (
        <div>
          <p className="font-mono text-sm">{row.zoneCode}</p>
          {row.zoneName ? <p className="text-muted text-xs">{row.zoneName}</p> : null}
        </div>
      ),
    },
    {
      id: "postcode",
      header: t("postcode"),
      cell: (row) =>
        row.postcode ? (
          <span className="font-mono">{row.postcode}</span>
        ) : (
          <span className="text-muted">{t("wholeZone")}</span>
        ),
    },
    { id: "weight", header: t("weight"), cell: (row) => band.weight(row.weightMinG, row.weightMaxG) },
    { id: "volume", header: t("volume"), cell: (row) => band.volume(row.volumeMinCm3, row.volumeMaxCm3) },
    { id: "amount", header: amountLabel, numeric: true, cell: (row) => format.thb(row.amount) },
    { id: "extra", header: t("perExtraKg"), numeric: true, cell: (row) => format.thb(row.perExtraKg) },
    ...extraColumns,
  ];
  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={sortRates(rows)}
      getRowId={(row) => row.id ?? `${row.zoneCode}:${row.postcode ?? ""}:${row.weightMinG}:${row.volumeMinCm3 ?? ""}`}
      empty={<EmptyState icon="truck" title={t("empty")} />}
    />
  );
}
