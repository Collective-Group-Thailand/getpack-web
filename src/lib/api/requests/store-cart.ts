/**
 * The customer's cart (F3 3.2 adds to it, 3.3 builds on it; B3.1, D-051, D-110).
 *
 * A cart line is a **quotation**, instant or from an accepted RFQ, so the price a line shows is
 * the price the customer was quoted. A quotation past its validity (D-051) is re-priced by the
 * API and the line says what changed; the customer confirms the new price before checking out,
 * because a price is never changed silently (design-system.md §1.3).
 *
 * D-110: several items, and each item's quantity may be split across delivery addresses. The
 * API checks that the split adds up; the browser only shows what it answered.
 */

import { z } from "zod";

import { addressSnapshot, designOption, mockupOption, productTypeRef } from "./admin-orders";
import { quoteSource } from "./admin-sales";
import { currency, dateTime, money, request, uuid } from "./define";

export const cartItemState = z.enum(["ok", "repriced", "unavailable"]).meta({ id: "CartItemState" });

export const cartDestination = z
  .object({
    id: uuid(),
    /** A saved address; `null` while the customer has not picked one yet. */
    addressId: uuid().nullable(),
    address: addressSnapshot.nullable(),
    quantity: z.number().int().positive(),
  })
  .meta({ id: "CartDestinationDto" });

export const cartItem = z
  .object({
    id: uuid(),
    quote: z.object({ id: uuid(), quoteCode: z.string(), validUntil: dateTime(), source: quoteSource }),
    product: z.object({ slug: z.string(), name: z.string(), imageUrl: z.string().nullable() }),
    productType: productTypeRef,
    specs: z.array(z.object({ label: z.string(), value: z.string() })),
    quantity: z.number().int(),
    unit: z.string(),
    unitPrice: z.string().describe("Decimal, up to 6 places"),
    grossAmount: money(),
    currency: currency(),
    designOption,
    mockupOption,
    /** Design options this line may switch to; changing one re-prices the line. */
    designOptions: z.array(designOption),
    destinations: z.array(cartDestination),
    state: cartItemState,
    /**
     * `repriced`: the quote expired and the API priced it again — both figures, so the page can
     * say what changed. `unavailable`: it could not be priced again (no instant path any more).
     */
    repricing: z
      .object({
        previousUnitPrice: z.string(),
        previousGrossAmount: money(),
        reason: z.enum(["quote_expired", "configuration_changed"]).meta({ id: "CartRepriceReason" }),
      })
      .nullable(),
    unavailableReason: z.string().nullable(),
  })
  .meta({ id: "CartItemDto" });

export const storeCart = z
  .object({
    id: uuid(),
    items: z.array(cartItem),
    itemCount: z.number().int(),
    /** Before promotions, points and shipping — those are the checkout's (3.3). */
    subtotalAmount: money(),
    vatAmount: money(),
    currency: currency(),
    /** Every line is priced and confirmed and every quantity has an address. */
    readyForCheckout: z.boolean(),
    blockers: z.array(
      z.object({
        itemId: uuid().nullable(),
        code: z.enum(["reprice_unconfirmed", "item_unavailable", "destination_missing", "split_mismatch"]),
        message: z.string(),
      }),
    ),
    updatedAt: dateTime(),
  })
  .meta({ id: "StoreCartDto" });

export const storeCartRequests = {
  "GET /v1/store/cart": request({
    request: "store.cart",
    summary: "The signed-in customer's cart, with expired quotations re-priced and the difference stated",
    decisions: ["D-051", "D-110"],
    response: storeCart,
  }),
  "POST /v1/store/cart/items": request({
    request: "store.cart",
    summary: "Put a quotation in the cart (instant or an accepted RFQ); one line per quotation",
    body: z.object({ quoteId: uuid() }),
    response: storeCart,
    status: 201,
  }),
  "PATCH /v1/store/cart/items/{itemId}": request({
    request: "store.cart",
    summary: "Change a line's design option or quantity; the API re-prices it",
    body: z.object({ designOption: designOption.optional(), quantity: z.number().int().positive().optional() }),
    response: storeCart,
  }),
  "DELETE /v1/store/cart/items/{itemId}": request({
    request: "store.cart",
    summary: "Remove a line",
    response: storeCart,
  }),
  "PUT /v1/store/cart/items/{itemId}/destinations": request({
    request: "store.cart",
    summary: "Split a line's quantity across saved addresses (D-110); the parts must add up to the quantity",
    decisions: ["D-110"],
    body: z.object({
      destinations: z
        .array(z.object({ addressId: uuid(), quantity: z.number().int().positive() }))
        .min(1)
        .max(20),
    }),
    response: storeCart,
  }),
  "POST /v1/store/cart/items/{itemId}/actions/accept-reprice": request({
    request: "store.cart",
    summary: "Confirm a re-priced line's new price (design-system §1.3: a price never changes silently)",
    decisions: ["D-051"],
    response: storeCart,
  }),
} as const;
