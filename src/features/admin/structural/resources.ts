/** The style work lists (U3.6), in a plain module so the shell can count them (sidebar badge) as the tabs do. */

import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";

import { asPage, defineList } from "../console/resource";

export type StructuralRequest = Schemas["AdminStructuralRequestDto"];
export type StyleIntake = Schemas["StyleIntakeDto"];

/** The steps of a structural request as the desk's tabs show them: the work first (D-273). */
export const STRUCTURAL_QUEUE = ["submitted", "assigned", "quoted", "delivered", "approved"] as const;
/** A factory's dieline offers by status, the ones to review first (D-272). */
export const INTAKE_QUEUE = ["submitted", "matched", "approved_recipe", "approved_template", "rejected"] as const;
/** The intake tab that is every offer; no `?status=` is the first queue. */
export const ALL_INTAKES = "all";

/**
 * Structural design requests (`admin.structuralRequests.list`, an unpaged array) as a list: `?status=` narrows it, no
 * status is every request.
 */
export const structuralRequestsList = defineList<StructuralRequest>({
  key: "structural-requests",
  fetch: async ({ contract }, { status }) =>
    asPage(
      (
        await contract.GET("/v1/admin/structural-requests", {
          params: { query: status ? { status: status as StructuralRequest["status"] } : {} },
        })
      ).data!,
    ),
  getRowId: (row) => row.id,
  defaults: { filterKeys: ["status"] },
  staleTime: STALE_TIME.live,
});

/**
 * Factories' dieline offers (`admin.styleIntakes.list`, an unpaged array): the desk opens on the new ones (no
 * `?status=`), `?status=all` is every offer.
 */
export const styleIntakesList = defineList<StyleIntake>({
  key: "style-intakes",
  fetch: async ({ contract }, { status }) => {
    const chosen = !status ? INTAKE_QUEUE[0] : status === ALL_INTAKES ? null : String(status);
    return asPage(
      (
        await contract.GET("/v1/admin/style-intakes", {
          params: { query: chosen ? { status: chosen as StyleIntake["status"] } : {} },
        })
      ).data!,
    );
  },
  getRowId: (row) => row.id,
  getRowName: (row) => row.title,
  defaults: { filterKeys: ["status"] },
  staleTime: STALE_TIME.live,
});
