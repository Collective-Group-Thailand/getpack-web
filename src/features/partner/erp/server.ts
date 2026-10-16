import "server-only";

import { attempt, partnerServerApis } from "@/features/partner/context/server";
import type { Schemas } from "@/lib/api/types";

/**
 * Reads the getpack Factory ERP screens share (E1, D-316): the factory's items, warehouses, suppliers
 * and settings, for the forms' pickers. Every list is the factory's own (`/factories/{factoryId}/erp`,
 * D-317); a picker shows active records only.
 */

type Contract = Awaited<ReturnType<typeof partnerServerApis>>["contract"];

/** Up to `pages` pages of 100 — a factory's item or supplier list, for a picker. */
async function everyPage<T>(
  read: (page: number) => Promise<{ data: T[]; meta: { total: number; perPage: number } } | undefined>,
  pages = 5,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= pages; page += 1) {
    const result = await read(page);
    if (!result) break;
    out.push(...result.data);
    if (page * result.meta.perPage >= result.meta.total) break;
  }
  return out;
}

export async function erpItems(contract: Contract, factoryId: string): Promise<Schemas["ErpItemDto"][]> {
  return everyPage(
    async (page) =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/items", {
          params: { path: { factoryId }, query: { perPage: 100, page } },
        })
      ).data,
  );
}

export async function erpSuppliers(contract: Contract, factoryId: string): Promise<Schemas["ErpTradingPartnerDto"][]> {
  return everyPage(
    async (page) =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/partners", {
          params: { path: { factoryId }, query: { perPage: 100, page, role: "supplier" } },
        })
      ).data,
  );
}

export async function erpWarehouses(contract: Contract, factoryId: string): Promise<Schemas["ErpWarehouseDto"][]> {
  return (
    (
      await contract.GET("/v1/partner/factories/{factoryId}/erp/warehouses", {
        params: { path: { factoryId } },
      })
    ).data ?? []
  );
}

/** Items, warehouses and suppliers for a stock or purchasing form, or the first failure. */
export async function erpPickers(factoryId: string) {
  const { contract } = await partnerServerApis();
  return attempt(async () => {
    const [items, warehouses, suppliers] = await Promise.all([
      erpItems(contract, factoryId),
      erpWarehouses(contract, factoryId),
      erpSuppliers(contract, factoryId),
    ]);
    return {
      items: items.filter((item) => item.status === "active"),
      warehouses: warehouses.filter((warehouse) => warehouse.status === "active"),
      suppliers,
    };
  });
}

export type ErpPickers = NonNullable<Awaited<ReturnType<typeof erpPickers>>["data"]>;
