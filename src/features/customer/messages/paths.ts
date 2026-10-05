import { studioHref } from "@/features/customer/studio/paths";

/** Where a context card opens on the storefront. */
export function storeCardHref(card: { id: string } & { type: string }): string | null {
  switch (card.type) {
    case "order":
      return `/account/orders/${card.id}`;
    case "design":
      return studioHref({ designId: card.id });
    case "rfq":
      return `/account/rfqs/${card.id}`;
    case "quote":
      return "/account/quotes";
    case "rfq_basket":
      return `/account/rfq-baskets/${card.id}`;
    default:
      return null;
  }
}
