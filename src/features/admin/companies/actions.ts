/**
 * The account actions the company screen offers, from the company's status and what the actor may
 * do. A plain module so the rule is testable without React.
 *
 * CONTRACT-GAP admin.companies — `AdminCompanyDto` carries no `allowedActions` / `nextActions`
 * (companies are not among the v0.6.0 `entity.next-actions` entities), so the screen reads the
 * status here, in one place (D-120): a company under review is approved or sent back
 * (`companies.kyc_review`, as the operations require); an active one can be suspended, a suspended
 * one reactivated, and any open one closed (`companies.manage`). It only decides which buttons to
 * show: the API still refuses what the workflow does not allow (`companies.invalid_status`,
 * `companies.kyc_incomplete`). Moved here from the interim `src/domain/next-actions/admin.ts`.
 */

import type { Schemas } from "@/lib/api/types";

/** A company action the desk can offer: the KYC decisions and the status actions (`Schemas["CompanyAction"]`). */
export type CompanyActionKey = "approve-kyc" | "reject-kyc" | Schemas["CompanyAction"];

export interface CompanyAction {
  key: CompanyActionKey;
  /** Suspending and closing are confirmed by typing the company code. */
  destructive?: boolean;
  /** `ReasonDto`: every action but approve-kyc is sent with a reason. */
  needsReason: boolean;
}

export function companyActions(
  status: Schemas["CompanyStatus"],
  can: (permission: string) => boolean,
): CompanyAction[] {
  const actions: CompanyAction[] = [];
  if (status === "kyc_review" && can("companies.kyc_review")) {
    actions.push({ key: "approve-kyc", needsReason: false }, { key: "reject-kyc", needsReason: true });
  }
  if (can("companies.manage")) {
    if (status === "active") actions.push({ key: "suspend", destructive: true, needsReason: true });
    if (status === "suspended") actions.push({ key: "reactivate", needsReason: true });
    if (status !== "closed") actions.push({ key: "close", destructive: true, needsReason: true });
  }
  return actions;
}
