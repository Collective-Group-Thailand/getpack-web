import { defineList } from "../console/resource";
import type { User } from "./grants";

export const usersList = defineList<User>({
  key: "user",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/users", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.email ?? row.displayName,
  defaults: { filterKeys: ["kind", "status"], sort: "createdAt", order: "desc", filters: { kind: "staff" } },
});
