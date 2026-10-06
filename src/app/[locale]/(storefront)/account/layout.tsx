import { cookies } from "next/headers";

import { AccountNav, type AccountCompany } from "@/features/customer/account/AccountNav";
import { getApprovals, getMyCompany } from "@/features/customer/business/api.server";
import { readAccessToken } from "@/lib/auth/session";

/**
 * The account's frame (F3 3.4): its sections beside every account page once signed in. Each page
 * still guards itself — `/account/designs` is also a guest's (designs are kept in the browser) —
 * so the layout only decides whether to show the sections, from the session cookie's presence.
 * A company member also gets "บริษัทของฉัน", with what waits for their approval (round 2, B2).
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const signedIn = Boolean(readAccessToken(await cookies()));
  return (
    <div className="max-w-content mx-auto px-5 py-8 md:px-8">
      {signedIn ? (
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
          <AccountNav company={await accountCompany()} />
          <div className="min-w-0">{children}</div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/** The member's company for the nav, or `null` — a failed read hides the group, never the page. */
async function accountCompany(): Promise<AccountCompany | null> {
  try {
    const company = await getMyCompany();
    if (!company) return null;
    const pending = company.can.approveOrders ? await getApprovals(company.id, "pending") : null;
    return {
      name: company.tradeName ?? company.legalName,
      can: company.can,
      pendingApprovals: pending?.length ?? 0,
    };
  } catch {
    return null;
  }
}
