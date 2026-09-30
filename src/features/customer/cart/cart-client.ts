"use client";

import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";

import type { Cart } from "./cart";

export { lineBlockers, type Cart, type CartItem } from "./cart";

/**
 * The cart is one editable aggregate (`store.cart.*`): every edit but a removal and a re-price
 * carries `If-Match` with the `ETag` of the cart as last read, and answers with the next one.
 *
 * So edits go one at a time, each under the tag the previous one returned — a second edit started
 * while the first is in flight (the checkout's destinations, one per line) would otherwise send a
 * stale tag and be refused with `412`. An answer without a tag (a removal, a re-price) means the
 * next edit reads the cart again first, and so does a `412`: the cart changed elsewhere, and the
 * page shows the cart as it is now rather than retrying over it.
 */

let etag: string | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** The cart as it is now; its `ETag` is kept for the next edit. */
export async function readCart(): Promise<Cart> {
  const { data, response } = await browserApi().GET("/v1/store/cart");
  etag = response.headers.get("etag");
  return data!;
}

/** One edit, in turn, under the current `ETag`; resolves to the cart after it. */
export function editCart(edit: (ifMatch: string) => Promise<{ data?: Cart; response: Response }>): Promise<Cart> {
  const run = queue.then(async () => {
    if (!etag) await readCart();
    try {
      const { data, response } = await edit(etag!);
      etag = response.headers.get("etag");
      return etag && data ? data : readCart();
    } catch (error) {
      if (isApiError(error) && error.status === 412) etag = null;
      throw error;
    }
  });
  queue = run.catch(() => undefined);
  return run;
}
