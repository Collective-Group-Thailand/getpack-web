/** The production board's counts, in a plain module so the shell can read them (sidebar badge) as the board does. */

import { defineList } from "../console/resource";

/**
 * The board's own totals (`admin.production.board`) as a countable list: the jobs on the board, or with
 * `?atRisk=true` the at-risk ones, for the board's filters (`?factoryId`, `?productTypeCode`). The board's view tabs
 * and the sidebar badge read this, so both say what the board's columns add up to. It carries no rows — the cards
 * are `admin.production.list`'s.
 */
export const productionBoardCount = defineList<{ id: string }>({
  key: "production_board",
  fetch: async ({ contract }, { atRisk, factoryId, productTypeCode }) => {
    const filters = {
      ...(factoryId ? { factoryId: String(factoryId) } : {}),
      ...(productTypeCode ? { productTypeCode: String(productTypeCode) } : {}),
    };
    const board = (await contract.GET("/v1/admin/production-board", { params: { query: filters } })).data!;
    return { data: [], meta: { page: 1, perPage: 1, total: atRisk === "true" ? board.atRisk : board.total } };
  },
  getRowId: (row) => row.id,
  defaults: { filterKeys: ["atRisk", "factoryId", "productTypeCode"] },
});
