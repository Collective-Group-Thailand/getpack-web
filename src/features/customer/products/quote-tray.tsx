"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo } from "react";

import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";

import { trayId, trayStore, useTray, type TrayItem } from "./rfq-store";

/**
 * The quote tray, wherever it lives (owner decision D-447 / DECISIONS-STAGE-A §10.9):
 * - a guest keeps it in this browser (`rfq-store`);
 * - a signed-in customer's tray IS the draft RFQ basket (D-301): each product goes straight in as a line whose form is
 *   still to be filled (`store.rfqBaskets.addProduct`, `formPending`), so it follows the account across devices;
 * - a guest tray merges into the basket once the customer is signed in (here, on the first page that knows it).
 * The account mode needs the API's product reference (`FEATURE_RFQ_PRODUCT_REF`); without it the browser tray stays.
 */
export interface QuoteTrayMode {
  signedIn: boolean;
  /** The tray is the server basket (signed in and the product reference is on). */
  account: boolean;
}

const QuoteTrayContext = createContext<QuoteTrayMode>({ signedIn: false, account: false });

export const DRAFT_BASKET_KEY = ["customer", "rfq-basket", "draft"] as const;

type Basket = Schemas["RfqBasketDto"];
type Line = Basket["items"][number];

/** A pending basket line as a tray item (its line id kept, to remove it). */
export function lineTrayItem(line: Line): (TrayItem & { lineId: string }) | null {
  if (!line.formPending || !line.product) return null;
  return {
    kind: line.product.kind === "stock_product" ? "stock" : "catalog",
    key: line.product.key,
    productTypeCode: line.productType.code,
    categoryCode: line.categoryCode,
    nameTh: line.product.nameTh,
    nameEn: line.product.nameEn,
    lineId: line.id,
  };
}

export const pendingItems = (basket: Basket | null | undefined) =>
  (basket?.items ?? []).flatMap((line) => {
    const item = lineTrayItem(line);
    return item ? [item] : [];
  });

const productBody = (item: Pick<TrayItem, "kind" | "key">) =>
  item.kind === "stock" ? { stockProductSku: item.key } : { catalogProductSlug: item.key };

/** Puts one product in the draft basket as a pending line (a product already waiting is not added twice). */
export async function addBasketProduct(item: Pick<TrayItem, "kind" | "key">): Promise<Basket> {
  const { data } = await browserApi().POST("/v1/store/rfq-baskets/draft/products", {
    params: { header: { "Idempotency-Key": newIdempotencyKey() } },
    body: productBody(item),
  });
  return data!;
}

export async function readDraftBasket(): Promise<Basket> {
  return (await browserApi().GET("/v1/store/rfq-baskets/draft")).data!;
}

let merging: Promise<boolean> | null = null;

/**
 * Moves the browser's tray into the draft basket, item by item, each leaving the browser once the basket holds it.
 * Resolves true when anything moved. One merge at a time; an item the API refuses stays in the browser.
 */
export function mergeGuestTray(): Promise<boolean> {
  merging ??= (async () => {
    let moved = false;
    try {
      for (const item of trayStore.items()) {
        try {
          await addBasketProduct(item);
          trayStore.remove(item);
          moved = true;
        } catch {
          // Refused (inactive, basket full): it stays in this browser's tray.
        }
      }
    } finally {
      merging = null;
    }
    return moved;
  })();
  return merging;
}

/** Where the tray walk goes after `current` is done (filled or skipped): the next waiting item, else the basket. */
export async function nextTrayHref(
  current: Pick<TrayItem, "kind" | "key"> | null,
  account: boolean,
  hrefOf: (item: TrayItem) => string,
  done: string,
): Promise<string> {
  if (current) trayStore.remove(current);
  if (!account) {
    const next = trayStore.items()[0];
    return next ? hrefOf(next) : done;
  }
  await mergeGuestTray();
  const waiting = pendingItems(await readDraftBasket().catch(() => null)).filter(
    (item) => !current || trayId(item) !== trayId(current),
  );
  return waiting[0] ? hrefOf(waiting[0]) : done;
}

export function QuoteTrayProvider({ signedIn, account, children }: QuoteTrayMode & { children: React.ReactNode }) {
  const value = useMemo(() => ({ signedIn, account: signedIn && account }), [signedIn, account]);
  return (
    <QuoteTrayContext.Provider value={value}>
      {value.account ? <GuestTrayMerge /> : null}
      {children}
    </QuoteTrayContext.Provider>
  );
}

/** Signed in with a browser tray left from before: it joins the basket once, then the page reads it again. */
function GuestTrayMerge() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const local = useTray();
  useEffect(() => {
    if (local.length === 0) return;
    void mergeGuestTray().then((moved) => {
      if (!moved) return;
      void queryClient.invalidateQueries({ queryKey: DRAFT_BASKET_KEY });
      router.refresh();
    });
  }, [local.length, queryClient, router]);
  return null;
}

export const useQuoteTrayMode = () => useContext(QuoteTrayContext);

export interface QuoteTray {
  mode: QuoteTrayMode;
  items: (TrayItem & { lineId?: string })[];
  has: (item: Pick<TrayItem, "kind" | "key">) => boolean;
  /** `full` when the tray (or the basket, D-301: 20 lines) is full; `failed` when the API refused otherwise. */
  add: (item: TrayItem) => Promise<"added" | "full" | "failed">;
  remove: (item: Pick<TrayItem, "kind" | "key">) => Promise<void>;
  clear: () => Promise<void>;
}

/** The tray of this page, in whichever place it lives (see `QuoteTrayMode`). */
export function useQuoteTray(): QuoteTray {
  const mode = useQuoteTrayMode();
  const local = useTray();
  const queryClient = useQueryClient();
  const basket = useQuery({
    queryKey: DRAFT_BASKET_KEY,
    queryFn: readDraftBasket,
    enabled: mode.account,
    staleTime: 30_000,
  });
  const items = useMemo(
    (): (TrayItem & { lineId?: string })[] => (mode.account ? pendingItems(basket.data) : local),
    [mode.account, basket.data, local],
  );
  const set = useCallback((next: Basket) => queryClient.setQueryData(DRAFT_BASKET_KEY, next), [queryClient]);
  const removeLine = useCallback(
    async (lineId: string) =>
      set(
        (
          await browserApi().DELETE("/v1/store/rfq-baskets/draft/items/{itemId}", {
            params: { path: { itemId: lineId } },
          })
        ).data!,
      ),
    [set],
  );

  return useMemo(
    (): QuoteTray => ({
      mode,
      items,
      has: (item) => items.some((entry) => trayId(entry) === trayId(item)),
      async add(item) {
        if (!mode.account) return trayStore.add(item) ? "added" : "full";
        try {
          set(await addBasketProduct(item));
          return "added";
        } catch (error) {
          return isApiError(error) && error.errors.some((entry) => entry.path === "items") ? "full" : "failed";
        }
      },
      async remove(item) {
        if (!mode.account) return trayStore.remove(item);
        const line = items.find((entry) => trayId(entry) === trayId(item));
        if (line?.lineId) await removeLine(line.lineId);
      },
      async clear() {
        if (!mode.account) return trayStore.clear();
        for (const line of items) if (line.lineId) await removeLine(line.lineId);
      },
    }),
    [mode, items, set, removeLine],
  );
}
