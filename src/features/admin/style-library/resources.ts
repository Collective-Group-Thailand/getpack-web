/** The style library desk's lists and types (D-411), in a plain module so Server Components can prefetch. */

import type { Schemas } from "@/lib/api/types";

import { defineList } from "../console/resource";

export type AdminStyle = Schemas["AdminStyleBaseDto"];
export type AdminStyleDetail = Schemas["AdminStyleBaseDetailDto"];
export type AdminStyleVariant = Schemas["AdminStyleVariantDto"];
export type StyleImportRun = Schemas["StyleImportRunDto"];
export type StyleImportPreview = Schemas["StyleImportPreviewDto"];
export type PublishReason = Schemas["StylePublishReason"];
export type PriceReason = Schemas["StylePriceReason"];

export const PUBLISH_REASONS = [
  "retired",
  "hidden",
  "wave_not_open",
  "no_product_type",
  "no_recipe",
  "recipe_not_approved",
  "names_not_approved",
  "not_makeable",
  "not_drawable",
] as const satisfies readonly PublishReason[];

export const STYLE_CATEGORIES = [
  "folding_carton",
  "corrugated",
  "rigid",
  "flexible",
  "label",
  "tag_sleeve",
  "insert",
] as const;

export const stylesList = defineList<AdminStyle>({
  key: "style",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/styles", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.code,
  defaults: { filterKeys: ["category", "status", "published"], perPage: 50 },
});

export const importsList = defineList<StyleImportRun>({
  key: "style_import",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/style-imports", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.fileName,
});

/** Where the desk's screens are. */
export const LIBRARY_HREF = "/style-library";
export const styleDeskHref = (id: string) => `${LIBRARY_HREF}/${id}`;
