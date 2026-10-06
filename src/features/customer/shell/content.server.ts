import "server-only";

import { cache } from "react";

import { listArticles } from "@/features/customer/catalog/api.server";
import { listGlossary, listLearningPaths, listMaterials } from "@/features/customer/learn/api.server";

/**
 * The content sections that have nothing published yet. Each check is the list the page itself
 * reads (cached as that page caches it); one that fails keeps its link — a missing link is worse
 * than an empty page.
 */
export const emptyContent = cache(async function emptyContent(): Promise<ReadonlySet<string>> {
  const isEmpty = (read: Promise<number>) => read.then((count) => count === 0).catch(() => false);
  const [articles, glossary, learn, materials] = await Promise.all([
    isEmpty(listArticles({ perPage: 1 }).then((page) => page.meta.total)),
    isEmpty(listGlossary().then((rows) => rows.length)),
    isEmpty(listLearningPaths().then((rows) => rows.length)),
    isEmpty(listMaterials().then((rows) => rows.length)),
  ]);
  return new Set(
    [articles && "/articles", glossary && "/help/glossary", learn && "/learn", materials && "/materials"].filter(
      (href): href is string => Boolean(href),
    ),
  );
});
