/**
 * Points & Deals P1.5: what Marketing edits to put a promotion on the deals surface.
 *
 * CONTRACT: API-CHANGES-P15 (Admin). `PATCH /v1/admin/promotions/{promotionId}` is published, so its new fields
 * cannot be a request definition of their own (`registry.test.ts` would refuse a published path): they are this
 * schema, merged into the published body at one call site and read back from the published response with
 * `safeParse` (`features/admin/marketing/promotion-display.ts`). CONTRACT-REQUEST admin.promotions.display.
 * The hero image has its own new operation below.
 */

import { z } from "zod";

import { request, uuid } from "./define";

export const PROMOTION_VISIBILITIES = ["public", "unlisted", "hidden"] as const;

const localized = z.object({ th: z.string(), en: z.string() });

export const promotionDisplay = z
  .object({
    headline: localized,
    subline: localized,
    badge: localized.nullable(),
    terms: localized,
    heroImageKey: z.string().nullable(),
    featured: z.boolean(),
    /** Unique among promotions that are not hidden. */
    slug: z.string(),
  })
  .meta({ id: "PromotionDisplayDto" });

/** The fields `admin.promotions.update` accepts and `admin.promotions.get` returns from P1.5 on. */
export const promotionPublicFields = z
  .object({
    /** Default `hidden`: existing promotions stay off every store surface. */
    visibility: z.enum(PROMOTION_VISIBILITIES).meta({ id: "PromotionVisibility" }),
    display: promotionDisplay.nullable(),
    displaySchemaVersion: z.number().int().optional(),
    heroImageUrl: z.string().nullable().optional(),
  })
  .meta({ id: "PromotionPublicFields" });

export const adminPromotionsRequests = {
  "POST /v1/admin/promotions/{promotionId}/hero-image": request({
    request: "admin.promotions.display",
    summary: "Attach an uploaded image (files presign → complete, purpose image) as the deal's hero image",
    body: z.object({ fileId: uuid() }),
    response: z.object({ heroImageKey: z.string(), heroImageUrl: z.string() }),
  }),
} as const;

export type PromotionVisibility = (typeof PROMOTION_VISIBILITIES)[number];
export type PromotionDisplay = z.infer<typeof promotionDisplay>;
export type PromotionPublicFields = z.infer<typeof promotionPublicFields>;
