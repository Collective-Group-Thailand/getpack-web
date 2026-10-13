import "server-only";

import { partnerServerApis } from "@/features/partner/context/server";

/**
 * Reads the E6 ledger screens share (D-385 – D-396): the factory's accounts as `{ id: code, label, hint }` options for
 * the journal and settings pickers. A list the reader may not see comes back empty rather than failing the page.
 */

type Contract = Awaited<ReturnType<typeof partnerServerApis>>["contract"];
export type AccountOption = { id: string; label: string; hint?: string | null; control?: boolean };

const quiet = async <T>(read: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await read();
  } catch {
    return fallback;
  }
};

/** Every account of the chart (postable ones for pickers), across pages. */
export async function ledgerAccounts(contract: Contract, factoryId: string, postable = true) {
  return quiet(async () => {
    const out: { id: string; code: string; nameTh: string; isControl: boolean; status: string; accountType: string }[] = [];
    for (let page = 1; page <= 5; page++) {
      const { data } = await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/accounts", {
        params: { path: { factoryId }, query: { page, perPage: 100, ...(postable ? { postable: true } : {}) } },
      });
      if (!data) break;
      out.push(...data.data);
      if (out.length >= data.meta.total) break;
    }
    return out;
  }, []);
}

/** Postable active accounts as picker options; control accounts flagged (documents only, D-386). */
export async function accountOptions(contract: Contract, factoryId: string): Promise<AccountOption[]> {
  return (await ledgerAccounts(contract, factoryId))
    .filter((a) => a.status === "active")
    .map((a) => ({ id: a.code, label: `${a.code} ${a.nameTh}`, hint: a.accountType, control: a.isControl }));
}
