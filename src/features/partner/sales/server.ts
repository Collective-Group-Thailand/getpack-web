import "server-only";

import { attempt, partnerServerApis } from "@/features/partner/context/server";
import { erpItems, erpWarehouses } from "@/features/partner/erp/server";
import type { Schemas } from "@/lib/api/types";

import type { SalesPickers } from "./types";

/**
 * Reads the E4 sales screens share (D-359 – D-365): the factory's customers, the people who can own a customer
 * or a deal, items and warehouses — for the forms' pickers.
 */

type Contract = Awaited<ReturnType<typeof partnerServerApis>>["contract"];

export async function erpCustomers(contract: Contract, factoryId: string): Promise<Schemas["ErpTradingPartnerDto"][]> {
  const out: Schemas["ErpTradingPartnerDto"][] = [];
  for (let page = 1; page <= 5; page += 1) {
    const { data } = await contract.GET("/v1/partner/factories/{factoryId}/erp/partners", {
      params: { path: { factoryId }, query: { perPage: 100, page, role: "customer" } },
    });
    if (!data) break;
    out.push(...data.data);
    if (page * data.meta.perPage >= data.meta.total) break;
  }
  return out.filter((partner) => partner.status === "active");
}

export async function erpSalespeople(contract: Contract, factoryId: string): Promise<Schemas["ErpSalespersonOptionDto"][]> {
  return (
    (
      await contract.GET("/v1/partner/factories/{factoryId}/erp/salespeople", {
        params: { path: { factoryId } },
      })
    ).data ?? []
  );
}

/** Customers, salespeople, items and warehouses for a sales document form, or the first failure. */
export async function salesPickers(factoryId: string): Promise<{ data: SalesPickers | null; error: unknown }> {
  const { contract } = await partnerServerApis();
  return attempt(async () => {
    const [customers, people, items, warehouses] = await Promise.all([
      erpCustomers(contract, factoryId),
      erpSalespeople(contract, factoryId),
      erpItems(contract, factoryId),
      erpWarehouses(contract, factoryId),
    ]);
    return {
      customers: customers.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        paymentTermDays: c.paymentTermDays,
        address: c.address,
        salespersonId: c.salesperson?.id ?? null,
      })),
      people: people.map((p) => ({ id: p.id, name: p.name, roles: p.roles })),
      items: items
        .filter((item) => item.status === "active")
        .map((item) => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          baseUnit: item.baseUnit,
          onHand: item.stock.onHand,
          available: item.stock.available,
        })),
      warehouses: warehouses
        .filter((warehouse) => warehouse.status === "active")
        .map((w) => ({ id: w.id, code: w.code, name: w.name, isDefault: w.isDefault })),
    };
  });
}

export type { SalesPickers };
