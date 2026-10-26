"use client";

import { useLocale, useTranslations } from "next-intl";

import { pick } from "@/features/customer/catalog/localize";
import { Checkbox } from "@/ui/components/Checkbox";
import { MaterialSwatch } from "@/ui/components/MaterialSwatch";
import { RadioCards } from "@/ui/components/RadioCards";

import type { ChoiceGroup, StoreOption } from "./model";
import { choiceOf, idsOfChoice, methodOf, sideModelOf, withExtraInks, type PrintKind } from "./print-model";
import type { Configurator } from "./state";

interface PrintSideChoiceProps {
  configurator: Configurator;
  group: ChoiceGroup & { kind: PrintKind };
  /** The ink ids this side holds (`state.choices.print_*`, or a part's own print). */
  ids: string[];
  onChange: (ids: string[]) => void;
  byId: ReadonlyMap<string, StoreOption>;
}

const NONE = "none";

/**
 * One corrugate side, one method (D-443): ไม่พิมพ์ · each offered spot colour · CMYK, as a single-choice
 * radio group built from the product's `printModel`. Only what the API offers is shown. Spot colours
 * beyond one (N > 1) and the CMYK add-on are extra ticks beside the method, and only when the API
 * says so. Without a model the product's ink list is the radios, plus "ไม่พิมพ์".
 */
export function PrintSideChoice({ configurator, group, ids, onChange, byId }: PrintSideChoiceProps) {
  const t = useTranslations("configurator.choices");
  const locale = useLocale();
  const side = sideModelOf(configurator, group.kind);
  const name = (id: string) => {
    const option = byId.get(id);
    return option ? pick(locale, option.nameTh, option.nameEn) : id;
  };
  const swatchOf = (id: string) => {
    const option = byId.get(id);
    return option && (option.swatchHex || option.imageUrl) ? (
      <MaterialSwatch colour={option.swatchHex} imageUrl={option.imageUrl} size="sm" />
    ) : undefined;
  };
  const label = t(`groups.${group.kind}`);

  if (!side) {
    // No model: the ink list as single-choice radios.
    const hasSwatch = group.options.some((option) => option.swatchHex || option.imageUrl);
    return (
      <RadioCards
        columns={2}
        aria-label={label}
        value={ids[0] ?? NONE}
        onValueChange={(id) => onChange(id === NONE ? [] : [id])}
        options={[
          { value: NONE, label: t("print.none") },
          ...group.options.map((option) => ({
            value: option.id,
            label: pick(locale, option.nameTh, option.nameEn),
            visual: hasSwatch ? (
              <MaterialSwatch colour={option.swatchHex} imageUrl={option.imageUrl} size="md" />
            ) : undefined,
          })),
        ]}
      />
    );
  }

  const spotIds = side.spot?.inkColourIds.filter((id) => byId.has(id)) ?? [];
  const maxSpot = side.spot?.maxColours ?? 0;
  const method = methodOf(side, ids);
  const options = [
    ...(side.methods.includes("none") ? [{ value: NONE, label: t("print.none") }] : []),
    ...(side.methods.includes("spot") && side.spot
      ? maxSpot === 1
        ? spotIds.map((id) => ({
            value: `spot:${id}`,
            label: name(id),
            description: t("print.spotOne"),
            visual: swatchOf(id),
          }))
        : spotIds.length > 0
          ? [{ value: "spot", label: t("print.spotMany"), description: t("print.upTo", { max: maxSpot }) }]
          : []
      : []),
    ...(side.methods.includes("cmyk") && side.cmyk
      ? [{ value: "cmyk", label: name(side.cmyk.inkColourId), description: t("ink.process") }]
      : []),
  ];

  // Extra inks beside the method: spot colours past the first (N > 1), or the CMYK add-on.
  const extra =
    method === "spot" && maxSpot > 1
      ? { ids: spotIds, max: maxSpot, min: 1, caption: t("print.spotPick", { max: maxSpot }) }
      : method === "cmyk" && side.cmyk?.addOn.enabled
        ? {
            ids: spotIds,
            max: side.cmyk.addOn.maxColours,
            min: 0,
            caption: t("print.addOn", { max: side.cmyk.addOn.maxColours }),
          }
        : null;
  const own = side.cmyk && method === "cmyk" ? ids.filter((id) => id !== side.cmyk!.inkColourId) : ids;

  return (
    <div className="flex flex-col gap-3">
      <RadioCards
        columns={2}
        aria-label={label}
        value={choiceOf(side, ids)}
        onValueChange={(choice) => onChange(idsOfChoice(side, choice, ids))}
        options={options}
      />
      {extra && extra.ids.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-muted text-xs">{extra.caption}</legend>
          {extra.ids.map((id) => {
            const checked = own.includes(id);
            return (
              <Checkbox
                key={id}
                checked={checked}
                disabled={checked ? own.length <= extra.min : own.length >= extra.max}
                onCheckedChange={(next) =>
                  onChange(withExtraInks(side, ids, next === true ? [...own, id] : own.filter((other) => other !== id)))
                }
                label={name(id)}
              />
            );
          })}
        </fieldset>
      ) : null}
    </div>
  );
}
