/**
 * The storefront mock's own records, where they differ from the published contract.
 *
 * These are the shapes the frontend once requested (F3) and the mocks were built around. Since
 * U-F0.2 the handlers answer with the published DTOs (`toCartDto`, `toSavedQuote`, …), projected
 * from these records; the records stay because the cart, checkout, RFQ and reorder mocks share
 * them and the admin zone's mocks still speak them until U-F0.3. Nothing in `src` may import this.
 */

import { z } from "zod";

import { addressSnapshot, designOption, mockupOption, productTypeRef } from "@/lib/api/requests/admin-orders";
import { quoteSource } from "@/lib/api/requests/admin-sales";
import { currency, dateTime, money, uuid } from "@/lib/api/requests/define";

/* ------------------------------------------------------------------------------------- cart */

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

export type Cart = z.output<typeof storeCart>;
export type Item = z.output<typeof cartItem>;
