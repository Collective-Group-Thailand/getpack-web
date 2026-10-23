import "server-only";

import { attempt, partnerServerApis } from "@/features/partner/context/server";
import { erpItems, erpSuppliers, erpWarehouses } from "@/features/partner/erp/server";
import { erpCustomers, erpSalespeople } from "@/features/partner/sales/server";

/**
 * Reads the E5 screens share (D-372 – D-381): items, machines, people, open production orders, recent goods
 * receipts and the inspection templates — as `{ id, label, hint }` options for the forms' pickers. A list the
 * reader may not see comes back empty rather than failing the page.
 */

type Contract = Awaited<ReturnType<typeof partnerServerApis>>["contract"];
export type Option = { id: string; label: string; hint?: string | null };

const quiet = async <T>(read: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await read();
  } catch {
    return fallback;
  }
};

export async function erpMachines(contract: Contract, factoryId: string): Promise<Option[]> {
  const { data } = await contract.GET("/v1/partner/factories/{factoryId}/erp/machine-rates", {
    params: { path: { factoryId } },
  });
  if (data) return data.map((r) => ({ id: r.machine.id, label: r.machine.name }));
  const machines = await contract.GET("/v1/partner/factories/{factoryId}/erp/machines", {
    params: { path: { factoryId } },
  });
  return (machines.data ?? []).map((m) => ({ id: m.id, label: m.name }));
}

export async function qualityPickers(factoryId: string) {
  const { contract } = await partnerServerApis();
  const path = { factoryId };
  return attempt(async () => {
    const [items, templates, orders, receipts, machines, people, customers, suppliers, warehouses] = await Promise.all([
      quiet(() => erpItems(contract, factoryId), []),
      quiet(
        async () =>
          (
            await contract.GET("/v1/partner/factories/{factoryId}/erp/inspection-templates", {
              params: { path, query: { perPage: 100 } },
            })
          ).data?.data ?? [],
        [],
      ),
      quiet(
        async () =>
          (
            await contract.GET("/v1/partner/factories/{factoryId}/erp/production-orders", {
              params: { path, query: { perPage: 100 } },
            })
          ).data?.data ?? [],
        [],
      ),
      quiet(
        async () =>
          (
            await contract.GET("/v1/partner/factories/{factoryId}/erp/goods-receipts", {
              params: { path, query: { perPage: 50 } },
            })
          ).data?.data ?? [],
        [],
      ),
      quiet(() => erpMachines(contract, factoryId), []),
      quiet(() => erpSalespeople(contract, factoryId), []),
      quiet(() => erpCustomers(contract, factoryId), []),
      quiet(() => erpSuppliers(contract, factoryId), []),
      quiet(() => erpWarehouses(contract, factoryId), []),
    ]);
    return {
      items: items.filter((i) => i.status === "active").map((i) => ({ id: i.id, label: i.name, hint: i.sku })),
      templates: templates.map((t) => ({ id: t.id, label: t.name, kind: t.kind, itemId: t.item?.id ?? null })),
      orders: orders
        .filter((o) => o.status !== "cancelled")
        .map((o) => ({ id: o.id, label: `${o.moNo} · ${o.title}`, hint: o.status })),
      receipts: receipts.map((r) => ({ id: r.id, label: `${r.grNo} · ${r.supplier.name}`, hint: r.receivedOn })),
      machines,
      people: people.map((p) => ({ id: p.id, label: p.name })),
      customers: customers.map((c) => ({ id: c.id, label: c.name, hint: c.code })),
      suppliers: suppliers.filter((s) => s.status === "active").map((s) => ({ id: s.id, label: s.name, hint: s.code })),
      warehouses: warehouses
        .filter((w) => w.status === "active")
        .map((w) => ({ id: w.id, label: w.name, hint: w.code })),
    };
  });
}

export type QualityPickers = NonNullable<Awaited<ReturnType<typeof qualityPickers>>["data"]>;
