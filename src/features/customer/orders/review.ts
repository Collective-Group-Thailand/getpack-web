import { z } from "zod";

import type { Schemas } from "@/lib/api/types";

/** My review of an order (`store.reviews.get` / `submit`, D-135). */
export type Review = Schemas["ReviewDto"];
export type ReviewPhoto = { id: string; url: string };

/** D-490: at most four photos on one review, in total. */
export const REVIEW_PHOTO_MAX = 4;
/** The photo picker's file rules (purpose `image`, scrubbed by the API). */
export const REVIEW_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic";
export const REVIEW_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Loyalty P2 adds `photos[]` and `photoRewardPoints` to `ReviewDto` (CONTRACT-REQUEST store.reviews.add-photos). Until
 * the release is adopted they are read back with `safeParse`: missing or malformed = no photos.
 */
const p2Fields = z.object({
  photos: z.array(z.object({ id: z.string(), url: z.string() })).optional(),
});

export function reviewPhotosOf(review: object): ReviewPhoto[] {
  const parsed = p2Fields.safeParse(review);
  return parsed.success ? (parsed.data.photos ?? []) : [];
}

/** Whether the order page offers the review: delivered, not cancelled (the API refuses `reviews.not_delivered`). */
export function canReview(order: { cancelledAt: string | null; receipt: { deliveredAt: string | null } }): boolean {
  return order.cancelledAt === null && order.receipt.deliveredAt !== null;
}
