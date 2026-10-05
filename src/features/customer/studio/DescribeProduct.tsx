"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { patternIssues } from "@/features/designer/components/SetupModal";
import type { DesignerCatalog } from "@/features/designer/data/api";
import type { BoxDims, DesignSpec } from "@/features/designer/types";
import { formatDimensions } from "@/i18n/format";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DimensionInput, type LengthUnit } from "@/ui/components/DimensionInput";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

import { suggestBoxes, type ShipsBy, type Suggestion } from "./suggest";

const SHIPS: ShipsBy[] = ["parcel", "pallet", "shelf"];

/**
 * ① "Describe your product" (studio-spec §2): the product's size as the customer measured it and how
 * it travels → three boxes it fits, each with its reasons; picking one sets the box and opens ②.
 */
export function DescribeProduct({
  catalog,
  onPick,
}: {
  catalog: DesignerCatalog | null;
  onPick: (spec: DesignSpec) => void;
}) {
  const t = useTranslations("studio.describe");
  const tSetup = useTranslations("designer.setup");
  const tCategories = useTranslations("designer.setup.categories");
  const locale = useLocale() as "th" | "en";
  const [unit, setUnit] = useState<LengthUnit>("mm");
  const [size, setSize] = useState<Record<"l" | "w" | "h", number | null>>({ l: null, w: null, h: null });
  const [shipsBy, setShipsBy] = useState<ShipsBy>("parcel");
  const [asked, setAsked] = useState<Suggestion[] | null>(null);
  const product: BoxDims | null = size.l && size.w && size.h ? { length: size.l, width: size.w, height: size.h } : null;

  const suggest = () => {
    if (!product) return;
    setAsked(
      suggestBoxes(product, shipsBy, catalog, locale, (patternId, values, style) =>
        patternIssues(
          patternId ? catalog?.patterns.find((p) => p.id === patternId) : undefined,
          values,
          style,
          locale,
          (key, v) => tSetup(key, v),
        ),
      ),
    );
  };

  return (
    <section className="space-y-3" aria-labelledby="studio-describe">
      <h3 id="studio-describe" className="text-sm font-semibold">
        {t("title")}
      </h3>
      <p className="text-muted text-xs">{t("hint")}</p>
      <DimensionInput
        legend={t("size")}
        unit={unit}
        onUnitChange={setUnit}
        unitLabels={{ mm: t("units.mm"), cm: t("units.cm"), in: t("units.in") }}
        unitToggleLabel={t("unit")}
        onChange={(key, valueMm) => {
          setSize((s) => ({ ...s, [key]: valueMm }));
          setAsked(null);
        }}
        axes={[
          { key: "l", label: t("axes.l"), valueMm: size.l },
          { key: "w", label: t("axes.w"), valueMm: size.w },
          { key: "h", label: t("axes.h"), valueMm: size.h },
        ]}
      />
      <SegmentedControl
        label={t("shipsBy")}
        size="sm"
        value={shipsBy}
        onValueChange={(next) => {
          setShipsBy(next);
          setAsked(null);
        }}
        options={SHIPS.map((value) => ({ value, label: t(`ships.${value}`) }))}
      />
      <Button size="sm" variant="secondary" disabled={!product} onClick={suggest}>
        {t("suggest")}
      </Button>
      {asked && asked.length === 0 ? <Callout tone="info" title={t("none")} /> : null}
      {asked && asked.length > 0 ? (
        <ol className="space-y-2" aria-label={t("results")}>
          {asked.map((suggestion) => (
            <li key={suggestion.spec.styleId} className="border-border rounded-card space-y-2 border p-3">
              <p className="text-sm font-medium">{suggestion.style.name[locale]}</p>
              <ul className="text-muted list-disc ps-4 text-xs">
                {suggestion.reasons.map((reason) => (
                  <li key={reason.code}>
                    {reason.code === "fits"
                      ? t("reasons.fits", { size: formatDimensions(reason.inside, locale) })
                      : reason.code === "family"
                        ? t(`reasons.family.${reason.shipsBy}`, { family: tCategories(reason.category) })
                        : reason.code === "advisor"
                          ? t("reasons.advisor")
                          : t("reasons.sheet", { width: reason.sheet.width, height: reason.sheet.height })}
                  </li>
                ))}
              </ul>
              <Button size="sm" onClick={() => onPick(suggestion.spec)}>
                {t("pick")}
              </Button>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
