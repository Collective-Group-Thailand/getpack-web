import { defineStatusMap } from "./types";
import type { CatalogStatus, ContentStatus } from "./contract";

/** A catalogue record: product type, pattern, material, stock product (B2.1). */
export const CATALOG_STATUS = defineStatusMap<CatalogStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "catalog.draft" },
  active: { tone: "success", icon: "check", labelKey: "catalog.active" },
  inactive: { tone: "neutral", icon: "pause", labelKey: "catalog.inactive" },
  archived: { tone: "neutral", icon: "archive", labelKey: "catalog.archived" },
});

/** CMS content: banners, articles, FAQs (B2.1). */
export const CONTENT_STATUS = defineStatusMap<ContentStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "content.draft" },
  published: { tone: "success", icon: "check", labelKey: "content.published" },
  archived: { tone: "neutral", icon: "archive", labelKey: "content.archived" },
});
