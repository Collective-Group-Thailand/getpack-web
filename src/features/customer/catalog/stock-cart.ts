"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { announceCartAdd } from "@/features/customer/cart/cart-events";
import { editCart } from "@/features/customer/cart/cart-client";
import { useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics/track";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { toast } from "@/ui/components/Toast";

/** The quote the API prices a stock product with: `standard_product`, the product, one quantity. */
export const stockQuoteBody = (stockProductId: string, quantity: number) => ({
  productTypeCode: "standard_product",
  configuration: { stockProductId, quantities: [quantity] } satisfies Schemas["StandardProductConfigurationDto"],
});

/**
 * Putting a stock product in the cart, from wherever a customer can do it (its page, the home
 * shelf): the API keeps the price as a quotation (`store.quotes.save`) and the cart takes that
 * line (`store.cart.addItem`, no design — there is nothing to print). The caller handles the
 * guest: a cart line is a customer's saved quotation (D-051), so sign-in comes first.
 * Resolves true when the line is in the cart; failures are toasted here.
 */
export function useAddStockToCart() {
  const t = useTranslations("catalog.stock");
  const router = useRouter();
  const queryClient = useQueryClient();
  return async ({
    stockProductId,
    quantity,
    name,
    route,
  }: {
    stockProductId: string;
    quantity: number;
    name: string;
    /** Where the customer did it, for analytics (`/products/[key]`, `/`). */
    route: string;
  }): Promise<boolean> => {
    try {
      const quote = (await browserApi().POST("/v1/store/quotes", { body: stockQuoteBody(stockProductId, quantity) }))
        .data!;
      const option = quote.options.find((candidate) => candidate.quantity === quantity) ?? quote.options[0]!;
      await editCart((ifMatch) =>
        browserApi().POST("/v1/store/cart/items", {
          params: { header: { "If-Match": ifMatch } },
          body: { quoteId: quote.id, quoteOptionId: option.id, designOption: "own_file" },
        }),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("customer", "cart") });
      announceCartAdd();
      track("cart_item_added", { route, productType: "standard_product", quantity, quoteMode: "instant" });
      toast.success(t("added", { name }), {
        action: { label: t("viewCart"), onClick: () => router.push("/cart") },
      });
      return true;
    } catch (error) {
      toast.error(t("failed"), isApiError(error) ? { description: error.detail } : undefined);
      return false;
    }
  };
}
