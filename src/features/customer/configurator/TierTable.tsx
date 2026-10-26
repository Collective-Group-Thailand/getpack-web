"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { PriceBreakTable } from "@/ui/components/PriceSummary";

import type { PriceStep } from "./pricing";
import { mergeEqualTiers, tierRowLabels } from "./tiers";

export interface TierTableProps {
  /** Every quantity the calculation priced. */
  steps: PriceStep[] | undefined;
  /** The quantity on screen, which the table marks. */
  quantity: number;
  unit: string;
  onSelectQuantity: (quantity: number) => void;
}

/**
 * The price per quantity (design-system.md §3 "PriceBreakTable"), from the API's own figures: it sits
 * with the quantity step, where the choice is made, not in the price summary. Quantities the API
 * prices at the same figure share a row; one without an instant price stays, with its reason.
 */
export function TierTable({ steps, quantity, unit, onSelectQuantity }: TierTableProps) {
  const t = useTranslations("configurator.dock");
  const format = useFormat();
  if (!steps || steps.length < 2) return null;
  const tierGroups = mergeEqualTiers(steps);
  const labelsOf = (group: (typeof tierGroups)[number]) =>
    tierRowLabels(group, {
      number: (value) => format.number(value),
      range: (from, to) => t("breaksRange", { from, to, unit }),
      withUnit: (amount) => t("breaksSelect", { quantity: amount, unit }),
    });
  return (
    <PriceBreakTable
      caption={t("breaksCaption")}
      headers={{
        quantity: t("breaksQuantity"),
        perPiece: t("breaksPerPiece"),
        total: t("breaksTotal"),
      }}
      rows={tierGroups.map((group) => {
        const { first } = group;
        const merged = group.steps.length > 1;
        const labels = labelsOf(group);
        const chosen = group.steps.find((entry) => entry.quantity === quantity);
        return {
          key: String(first.quantity),
          quantity: labels.quantity,
          perPiece: format.thb(first.unitPrice),
          // One row stands for several quantities, each with its own total: the chosen one's, else none.
          total: merged
            ? chosen
              ? format.thb(chosen.grossAmount)
              : t("breaksTotalVaries")
            : format.thb(first.grossAmount),
          selected: chosen !== undefined,
          unavailable: first.instant ? undefined : t(`reasons.${first.reason ?? "no_price_path"}`),
        };
      })}
      onSelect={(key) => {
        // A row of several quantities keeps the one already chosen inside it.
        const group = tierGroups.find((candidate) => String(candidate.first.quantity) === key);
        if (group && !group.steps.some((entry) => entry.quantity === quantity)) onSelectQuantity(group.first.quantity);
      }}
      selectLabel={(row) => {
        const group = tierGroups.find((candidate) => String(candidate.first.quantity) === row.key);
        return group ? labelsOf(group).select : String(row.quantity);
      }}
      selectText={t("breaksChoose")}
      selectedText={t("breaksChosen")}
    />
  );
}
