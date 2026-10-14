"use client";

import { useEffect, useRef, useState } from "react";

import { browserApi } from "@/lib/api/browser";

import { saveQuote } from "../configurator/pricing";
import { editCart, type Cart } from "./cart-client";
import { markTriedLines, readGuestCart, readTriedLines, removeGuestLine, type GuestCartLine } from "./guest-cart";

export interface GuestCartMerge {
  /** Lines being moved into the account's cart right now. */
  merging: boolean;
  /** Lines that moved, and the cart after the last of them. */
  merged: { count: number; cart: Cart } | null;
  /** Lines the API would not take (no instant price any more, a product withdrawn): left in place. */
  failed: GuestCartLine[];
}

/**
 * Moves the lines a guest kept in this browser into their account's cart, once, on the signed-in
 * cart page (UX audit Flow 1: "ถ้ามาจาก configure/cart ให้ merge guest cart เข้าบัญชี").
 *
 * Each line becomes a saved quotation at today's price (`store.quotes.save`, D-051) and then a cart
 * line (`store.cart.addItem`); a line is removed from this browser only once the API has it, so a
 * failure part-way leaves the rest to try again on the next visit.
 */
export function useGuestCartMerge(enabled: boolean): GuestCartMerge {
  const [state, setState] = useState<GuestCartMerge>({ merging: false, merged: null, failed: [] });
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || started.current) return;
    const tried = readTriedLines();
    const lines = readGuestCart().filter((line) => !tried.has(line.id));
    if (lines.length === 0) return;
    started.current = true;
    // Reading this browser's storage is only possible after hydration, so the effect starts it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((previous) => ({ ...previous, merging: true }));

    void (async () => {
      const failed: GuestCartLine[] = [];
      let cart: Cart | null = null;
      let count = 0;
      for (const line of lines) {
        try {
          const quote = await saveQuote(line.body);
          const option = quote.options.find((candidate) => candidate.quantity === line.quantity) ?? quote.options[0];
          if (!option) throw new Error("no-option");
          cart = await editCart((ifMatch) =>
            browserApi().POST("/v1/store/cart/items", {
              params: { header: { "If-Match": ifMatch } },
              body: { quoteId: quote.id, quoteOptionId: option.id, designOption: line.designOption },
            }),
          );
          removeGuestLine(line.id);
          count += 1;
        } catch {
          failed.push(line);
        }
      }
      markTriedLines(failed.map((line) => line.id));
      setState({ merging: false, merged: cart ? { count, cart } : null, failed });
    })();
  }, [enabled]);

  return state;
}
