import "server-only";

import type { z } from "zod";

import { isApiError } from "@/lib/api/problem";
import { serverRequests } from "@/lib/api/requests/server";
import type { glossaryTerm, learningPath, materialCard } from "@/lib/api/requests/store-content";

export type GlossaryTerm = z.output<typeof glossaryTerm>;
export type Material = z.output<typeof materialCard>;
export type LearningPath = z.output<typeof learningPath>;

/**
 * These endpoints are contract requests packio-api has not shipped: against a real backend they
 * answer 404, which reads as "nothing published yet" — each page's empty state — not a crash.
 * Any other failure still surfaces.
 */
async function orEmpty<T>(read: () => Promise<T[]>): Promise<T[]> {
  try {
    return await read();
  } catch (error) {
    if (isApiError(error) && error.status === 404) return [];
    throw error;
  }
}

// CONTRACT-REQUEST store.catalog-glossary
export async function listGlossary(): Promise<GlossaryTerm[]> {
  return orEmpty(
    async () => (await (await serverRequests("customer")).call("GET /v1/store/catalog/glossary-terms")).data,
  );
}

// CONTRACT-REQUEST store.catalog-materials
export async function listMaterials(): Promise<Material[]> {
  return orEmpty(async () => (await (await serverRequests("customer")).call("GET /v1/store/catalog/materials")).data);
}

// CONTRACT-REQUEST store.learning-paths
export async function listLearningPaths(): Promise<LearningPath[]> {
  return orEmpty(async () => (await (await serverRequests("customer")).call("GET /v1/store/learning-paths")).data);
}

/** Where a path ends: its action, pre-filled (U5.6 §2). */
export function actionHref(action: LearningPath["action"]): string {
  switch (action.target) {
    case "configurator":
      return action.productSlug
        ? `/configure/${action.productSlug}${action.materialOptionId ? `?material=${encodeURIComponent(action.materialOptionId)}` : ""}`
        : "/products";
    case "studio":
      return "/studio/new";
    case "styles":
      return "/styles";
    case "samples":
      return "/samples";
    case "rfq":
      return "/products";
  }
}
