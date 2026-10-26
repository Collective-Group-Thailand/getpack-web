import "server-only";

import { publicApi } from "@/features/customer/catalog/api.server";
import type { Schemas } from "@/lib/api/types";

export type Guarantee = Schemas["PublicGuaranteeDto"];
export type PublicReview = Schemas["PublicReviewDto"];
export type ReviewSummary = Schemas["ReviewSummaryDto"];

/** The guarantee in force (`store.guarantee.get`, D-260): the remedies matrix and its time limits. */
export async function getGuarantee(): Promise<Guarantee | null> {
  const { data } = await (await publicApi("content")).GET("/v1/store/guarantee");
  return data ?? null;
}

/** Verified, order-backed reviews (`store.reviews.listPublic`, D-181), newest first. */
export async function listReviews(page = 1): Promise<{ reviews: PublicReview[]; total: number }> {
  const { data } = await (
    await publicApi("content")
  ).GET("/v1/store/reviews", { params: { query: { page, perPage: 20 } } });
  return { reviews: data?.data ?? [], total: data?.meta.total ?? 0 };
}

export async function getReviewSummary(): Promise<ReviewSummary | null> {
  const { data } = await (await publicApi("content")).GET("/v1/store/reviews/summary");
  return data ?? null;
}
