"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import type { Configurator } from "@/features/customer/configurator/model";
import { useOptionPrices, type OptionPrices } from "@/features/customer/configurator/option-prices";
import { useLivePrice, type PriceStep } from "@/features/customer/configurator/pricing";
import { trackPdp, type PdpEvents } from "@/lib/analytics/pdp";

import { dielineTargetOf } from "../dieline-target";
import { bodyOf, configureLinkOf, startOf, type Selection } from "./model";

type OptionChange = Pick<PdpEvents["pdp_option_change"], "option" | "value">;

export interface PdpValue {
  configurator: Configurator;
  productName: string;
  signedIn: boolean;
  selection: Selection;
  /** One customer change: the new selection and, for analytics, what changed. */
  choose: (next: Selection, change: OptionChange) => void;
  /** The live calculation for every tier of the selection (debounced; the last one stays while the next loads). */
  price: ReturnType<typeof useLivePrice>;
  /** The selection's price at its quantity, when the API priced it instantly. */
  current: PriceStep | null;
  /** The steps of the calculation, one per tier (instant or not), as the API sent them. */
  steps: PriceStep[];
  /** The batch prices of the size / board / print cards at the selection's quantity. */
  optionPrices: OptionPrices;
  /** "ปรับแต่งต่อและสั่งซื้อ": the configurator on this selection. */
  configureLink: string;
  /** "แบบกล่องเบอร์ X": the free dieline of this product at the chosen size, or null. */
  dielineHref: string | null;
}

const PdpContext = createContext<PdpValue | null>(null);

export function usePdp(): PdpValue {
  const value = useContext(PdpContext);
  if (!value) throw new Error("usePdp outside PdpProvider");
  return value;
}

/** The buy box's pieces that may render outside a product with a configurator read it softly. */
export const useOptionalPdp = () => useContext(PdpContext);

/**
 * The product page's one selection (pdp redesign Phase 1): the buy box, the gallery's "ขนาดจริง",
 * the sizes table, the tiers card and the phone's buy bar all read and change the same configurator
 * state, priced once through the configurator's pricing (`useLivePrice`, `useOptionPrices`) — one
 * request per settled change, never one per card.
 */
export function PdpProvider({
  configurator,
  productName,
  signedIn,
  children,
}: {
  configurator: Configurator;
  productName: string;
  signedIn: boolean;
  children: React.ReactNode;
}) {
  const [selection, setSelection] = useState(() => startOf(configurator));
  const body = useMemo(() => bodyOf(configurator, selection), [configurator, selection]);
  const price = useLivePrice(body);
  const optionPrices = useOptionPrices(configurator, selection, body !== null);
  const steps = useMemo(() => price.data?.steps ?? [], [price.data]);
  const current = steps.find((step) => step.quantity === selection.quantity && step.instant) ?? null;

  // pdp_price_view: once per selection whose price has arrived (not per re-render, not while it loads).
  const viewed = useRef<string | null>(null);
  useEffect(() => {
    if (price.pending || !price.data) return;
    const key = `${JSON.stringify(body)}:${selection.quantity}`;
    if (viewed.current === key) return;
    viewed.current = key;
    trackPdp("pdp_price_view", {
      product: configurator.slug,
      size: selection.standardSizeCode,
      qty: selection.quantity,
      instant: current !== null,
    });
  }, [price.pending, price.data, body, selection, configurator.slug, current]);

  const value = useMemo<PdpValue>(
    () => ({
      configurator,
      productName,
      signedIn,
      selection,
      choose: (next, change) => {
        trackPdp("pdp_option_change", { product: configurator.slug, ...change });
        setSelection(next);
      },
      price,
      current,
      steps,
      optionPrices,
      configureLink: configureLinkOf(configurator, selection),
      dielineHref: dielineTargetOf(configurator, selection.standardSizeCode),
    }),
    [configurator, productName, signedIn, selection, price, current, steps, optionPrices],
  );
  return <PdpContext.Provider value={value}>{children}</PdpContext.Provider>;
}
