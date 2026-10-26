"use client";

import { useLocale, useTranslations } from "next-intl";

import { pick } from "@/features/customer/catalog/localize";
import { Badge } from "@/ui/components/Badge";
import { Checkbox } from "@/ui/components/Checkbox";
import { MaterialSwatch } from "@/ui/components/MaterialSwatch";
import { RadioCards } from "@/ui/components/RadioCards";

import type { ChoiceGroup, StoreOption } from "./model";
import { PriceSlot, useOptionFigures } from "./OptionFigure";
import { inkChoice, NO_MODEL_NONE, printKey, type OptionPrices } from "./option-prices";
import {
  choiceOf,
  choiceValues,
  defaultIds,
  idsOfChoice,
  methodOf,
  sideModelOf,
  withExtraInks,
  type PrintKind,
} from "./print-model";
import type { Configurator } from "./state";

interface PrintSideChoiceProps {
  configurator: Configurator;
  group: ChoiceGroup & { kind: PrintKind };
  /** The ink ids this side holds (`state.choices.print_*`, or a part's own print). */
  ids: string[];
  onChange: (ids: string[]) => void;
  byId: ReadonlyMap<string, StoreOption>;
  /**
   * The price change of each card against the current selection (the batch answer). Left out where the
   * cards are not compared (a box printed differently per part): then no figure is drawn.
   */
  prices?: OptionPrices;
}

const NONE = "none";

/**
 * One corrugate side, one method (D-443): ไม่พิมพ์ · each offered spot colour · CMYK, as a single-choice
 * radio group built from the product's `printModel`. Only what the API offers is shown. Spot colours
 * beyond one (N > 1) and the CMYK add-on are extra ticks beside the method, and only when the API
 * says so. Without a model the product's ink list is the radios, plus "ไม่พิมพ์".
 */
export function PrintSideChoice({ configurator, group, ids, onChange, byId, prices }: PrintSideChoiceProps) {
  const t = useTranslations("configurator.choices");
  const tOptions = useTranslations("configurator.options");
  const figures = useOptionFigures();
  const locale = useLocale();
  /** The change a card shows, in a slot that keeps its height; nothing where cards are not compared. */
  const trailingOf = (choice: string, selected: boolean) => {
    if (!prices) return undefined;
    const price = prices.price(printKey(group.kind, choice));
    return (
      <PriceSlot pending={prices.pending} unitPrice={price?.unitPrice} className="min-w-[4.5rem] text-end">
        {figures.delta(price, selected)}
      </PriceSlot>
    );
  };
  const defaultBadge = (
    <Badge size="sm" tone="neutral">
      {tOptions("default")}
    </Badge>
  );
  const noneNote = t(group.kind === "print_front" ? "print.noneOutside" : "print.noneInside");
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
  /** An ink's name with its small swatch beside it. */
  const inkLabel = (id: string) => (
    <span className="inline-flex items-center gap-2">
      {swatchOf(id)}
      {name(id)}
    </span>
  );
  const label = t(`groups.${group.kind}`);

  if (!side) {
    // No model: the ink list as single-choice cards.
    const current = ids[0] ? inkChoice(ids[0]) : NO_MODEL_NONE;
    return (
      <RadioCards
        columns={2}
        aria-label={label}
        value={ids[0] ?? NONE}
        onValueChange={(id) => onChange(id === NONE ? [] : [id])}
        options={[
          {
            value: NONE,
            label: t("print.none"),
            description: noneNote,
            trailing: trailingOf(NO_MODEL_NONE, current === NO_MODEL_NONE),
          },
          ...group.options.map((option) => ({
            value: option.id,
            label: inkLabel(option.id),
            trailing: trailingOf(inkChoice(option.id), current === inkChoice(option.id)),
          })),
        ]}
      />
    );
  }

  const spotIds = side.spot?.inkColourIds.filter((id) => byId.has(id)) ?? [];
  const maxSpot = side.spot?.maxColours ?? 0;
  const method = methodOf(side, ids);
  const chosen = choiceOf(side, ids);
  const starts = choiceOf(side, defaultIds(side));
  const optionOf = (choice: string) => {
    const common = {
      value: choice,
      badge: choice === starts ? defaultBadge : undefined,
      trailing: trailingOf(choice, choice === chosen),
    };
    if (choice === "none") return { ...common, label: t("print.none"), description: noneNote };
    if (choice === "cmyk") return { ...common, label: name(side.cmyk!.inkColourId), description: t("ink.process") };
    if (choice === "spot")
      return { ...common, label: t("print.spotMany"), description: t("print.upTo", { max: maxSpot }) };
    const id = choice.slice("spot:".length);
    return { ...common, label: inkLabel(id), description: t("print.spotOne") };
  };
  const options = choiceValues(side, (id) => byId.has(id)).map(optionOf);

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
        value={chosen}
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
