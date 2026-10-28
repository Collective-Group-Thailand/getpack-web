"use client";

import { useCallback, useEffect, useRef } from "react";

import { trackConfigurator } from "@/lib/analytics/configurator";

import type { ConfiguratorEventName, ConfiguratorEvents } from "@/lib/analytics/configurator";

import { groupsOf, optionsById, type Configurator } from "./model";
import { materialKey, printCardKey, printSideOf, sizeKey, type OptionPrices } from "./option-prices";
import { choiceOf, sideModelOf } from "./print-model";
import { POSTCODE, TARGET, type ConfiguratorState } from "./state";

export type Emit = <K extends ConfiguratorEventName>(event: K, properties: ConfiguratorEvents[K]) => void;

const same = (a: readonly string[] = [], b: readonly string[] = []) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * The analytics events one change of the configuration stands for, derived from the state before and after it
 * (so each fires once, at the action that made it, and a typed size or a restored draft fires nothing).
 *
 * The `delta` of a card is read from the batch answer of the card chosen — the API's string, never a
 * difference taken here. The postcode, the target price and the discount code are not handled here at all:
 * they never travel (`cfg_postcode_set` is emitted by the page with the area's name, `cfg_target_price_set`
 * without a value).
 */
export function emitChangeEvents(
  configurator: Configurator,
  before: ConfiguratorState,
  after: ConfiguratorState,
  prices: OptionPrices,
  emit: Emit,
): void {
  const byId = optionsById(configurator);
  const codes = (ids: string[]) => ids.map((id) => byId.get(id)?.code ?? id).join(",") || "none";

  if (before.sizeMode !== after.sizeMode) emit("cfg_size_mode", { mode: after.sizeMode });
  else if (
    after.sizeMode === "standard" &&
    after.standardSizeCode &&
    before.standardSizeCode !== after.standardSizeCode
  )
    emit("cfg_option_change", {
      step: "size",
      option: "size",
      value: after.standardSizeCode,
      delta: prices.price(sizeKey(after.standardSizeCode))?.delta ?? null,
    });

  for (const group of groupsOf(configurator)) {
    const was = before.choices[group.kind] ?? [];
    const now = after.choices[group.kind] ?? [];
    if (same(was, now)) continue;
    if (group.kind === "material") {
      const id = now[0];
      emit("cfg_option_change", {
        step: group.step,
        option: "material",
        value: id ? codes([id]) : "none",
        delta: id ? (prices.price(materialKey(id))?.delta ?? null) : null,
      });
    } else if (group.kind === "print_front" || group.kind === "print_back") {
      const key = printCardKey(configurator, group.kind, now);
      const side = sideModelOf(configurator, group.kind);
      emit("cfg_option_change", {
        step: group.step,
        option: `print_${printSideOf(group.kind)}`,
        value: side ? choiceOf(side, now) : codes(now),
        delta: key ? (prices.price(key)?.delta ?? null) : null,
      });
    } else {
      emit("cfg_option_change", { step: group.step, option: group.kind, value: codes(now), delta: null });
    }
  }

  if (before.quantity !== after.quantity || before.quantities.length !== after.quantities.length) {
    const added = after.quantities.length > before.quantities.length;
    if (added && !configurator.quantity.presets.includes(after.quantity))
      emit("cfg_qty_custom", { quantity: after.quantity });
    else if (before.quantity !== after.quantity && after.quantities.length >= before.quantities.length)
      emit("cfg_option_change", { step: "quantity", option: "quantity", value: String(after.quantity), delta: null });
  }

  if (before.designOption !== after.designOption) emit("cfg_design_path", { path: after.designOption });
}

/**
 * The page's reporter: `report(before, after, prices)` for every change the customer makes, which also
 * remembers the two things that are not a plain diff. A postcode the customer typed is reported once its area
 * is known — by the area's name, never the code; a remembered postcode that fills the field is not an action.
 * The target price is counted once while it holds a valid value — that it was set, never what it is.
 */
export function useChangeTracker(configurator: Configurator, postcode: string, zone: string | null) {
  const zoneToReport = useRef<string | null>(null);
  const targetReported = useRef(false);

  useEffect(() => {
    if (!zone || zoneToReport.current !== postcode) return;
    zoneToReport.current = null;
    trackConfigurator("cfg_postcode_set", { zone });
  }, [zone, postcode]);

  return useCallback(
    (before: ConfiguratorState, after: ConfiguratorState, prices: OptionPrices) => {
      emitChangeEvents(configurator, before, after, prices, trackConfigurator);
      if (after.postcode !== before.postcode && POSTCODE.test(after.postcode)) zoneToReport.current = after.postcode;
      if (after.target !== before.target) {
        // Typing "12.5" passes through "12." (not valid yet): only an emptied field starts counting afresh.
        if (after.target === "") targetReported.current = false;
        else if (TARGET.test(after.target) && !targetReported.current) {
          targetReported.current = true;
          trackConfigurator("cfg_target_price_set", {});
        }
      }
    },
    [configurator],
  );
}
