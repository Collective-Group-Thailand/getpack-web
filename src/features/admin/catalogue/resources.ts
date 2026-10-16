/** One list resource per declared table, in a plain module so Server Components can prefetch. */

import { defineList, type ListResource } from "../console/resource";
import { listRows, type CatalogueRow } from "./api";
import type { TableDef } from "./tables";

const lists = new Map<string, ListResource<CatalogueRow>>();

export function listFor(def: TableDef): ListResource<CatalogueRow> {
  const cached = lists.get(def.key);
  if (cached) return cached;
  const list = defineList<CatalogueRow>({
    // `catalog_material`, the realtime prefix getpack-api publishes (`catalog.material.updated`).
    key: `catalog_${def.key.replace(/-/g, "_")}`,
    fetch: ({ contract }, query) => listRows(contract, def.path, query),
    getRowId: (row) => row.id,
    getRowName: (row) =>
      String(row.code ?? row.sku ?? row.slug ?? row.pageKey ?? row.name ?? row.title ?? row.nameTh ?? row.id),
    defaults: {
      filterKeys: [...def.filters, ...(def.status ? ["status"] : [])],
      ...(def.defaultSort ? { sort: def.defaultSort, order: "asc" as const } : {}),
    },
  });
  lists.set(def.key, list);
  return list;
}
