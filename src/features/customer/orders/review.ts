import type { Schemas } from "@/lib/api/types";

/** My review of an order (`store.reviews.get` / `submit`, D-135). */
export type Review = Schemas["ReviewDto"];
export type ReviewPhoto = Schemas["ReviewPhotoDto"];

/** D-490: at most four photos on one review, in total. */
export const REVIEW_PHOTO_MAX = 4;
/** The photo picker's file rules (purpose `image`, scrubbed by the API). */
export const REVIEW_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic";
export const REVIEW_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** Whether the order page offers the review: delivered, not cancelled (the API refuses `reviews.not_delivered`). */
export function canReview(order: { cancelledAt: string | null; receipt: { deliveredAt: string | null } }): boolean {
  return order.cancelledAt === null && order.receipt.deliveredAt !== null;
}
