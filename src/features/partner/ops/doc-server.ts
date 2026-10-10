import "server-only";

import { canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { erpItems } from "@/features/partner/erp/server";

import type { LinkTargets } from "./DocumentForms";

/**
 * What a document can be linked to from the form (D-356): the machines, items and trading partners this
 * user may read. Orders are linked from their own page (the "add a document" button), which pre-fills them.
 */
export async function docLinkTargets(): Promise<LinkTargets> {
  const context = await factoryContext();
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const safe = async <T>(read: () => Promise<T[]>) => {
    try {
      return await read();
    } catch {
      return [];
    }
  };
  const [machines, items, partners] = await Promise.all([
    canAt(context, "factory_planning.read")
      ? safe(
          async () =>
            (await contract.GET("/v1/partner/factories/{factoryId}/erp/machines", { params: { path } })).data ?? [],
        )
      : [],
    canAt(context, "factory_inventory.read") ? safe(() => erpItems(contract, context.factoryId)) : [],
    canAt(context, "factory_trading_partners.read")
      ? safe(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/partners", {
                params: { path, query: { perPage: 100 } },
              })
            ).data?.data ?? [],
        )
      : [],
  ]);
  const targets: LinkTargets = {};
  if (partners.length) targets.trading_partner = partners.map((p) => ({ id: p.id, label: p.name }));
  if (items.length) targets.item = items.map((i) => ({ id: i.id, label: `${i.name} (${i.sku})` }));
  if (machines.length) targets.machine = machines.map((m) => ({ id: m.id, label: m.name }));
  return targets;
}
