import type { Schemas } from "@/lib/api/types";

export type CompanyRole = Schemas["CompanyRole"];

/** What a member's roles open in the company's pages (the published `can` map). */
export type CompanyCapabilities = Schemas["CompanyCapabilitiesDto"];

/**
 * The company pages a member's roles open (D-140: Company Admin, Buyer, Approver, Accountant).
 *
 * CONTRACT-GAP store.companies — the published company carries each member's roles but not the
 * capability map the request asked for, so the storefront reads the roles here, in one place. It
 * only decides what to offer: every action is still the API's to refuse (`auth.forbidden`), and the
 * page shows its problem.
 */
export function capabilitiesOf(roles: readonly CompanyRole[]): CompanyCapabilities {
  const has = (...wanted: CompanyRole[]) => wanted.some((role) => roles.includes(role));
  return {
    manageMembers: has("company_admin"),
    manageSettings: has("company_admin"),
    // D-227: brand assets are added and removed by the Company Admin only.
    manageAssets: has("company_admin"),
    approveOrders: has("company_approver"),
    viewFinance: has("company_admin", "company_accountant"),
    order: has("company_admin", "company_buyer", "company_approver"),
  };
}
