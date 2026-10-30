import { cookies } from "next/headers";

import { getPoints, getStoreCredit } from "@/features/customer/account/api.server";
import { AccountNav, type AccountCompany, type AccountMe } from "@/features/customer/account/AccountNav";
import { AccountTabs } from "@/features/customer/account/AccountTabs";
import { getApprovals, getMyCompany } from "@/features/customer/business/api.server";
import { getOrderTabCounts } from "@/features/customer/orders/api.server";
import { getFormat } from "@/features/shared/format/server";
import { getActor } from "@/lib/auth/actor";
import { readAccessToken } from "@/lib/auth/session";

/**
 * The account's frame (account pack Phase 1): the account menu beside every account page once signed in — who is
 * signed in with their points and store credit, nine sections, the orders that wait for the customer — and the
 * tabs of the section the page belongs to. Each page still guards itself — `/account/designs` is also a guest's
 * (designs are kept in the browser) — so the layout only decides whether to show the menu, from the session
 * cookie's presence. Every figure here is a convenience: a failed read hides it, never the page.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const signedIn = Boolean(readAccessToken(await cookies()));
  if (!signedIn)
    return <div className="max-w-nav mx-auto px-5 pt-6 pb-16 md:px-8 md:pt-8 md:pb-20 xl:px-12">{children}</div>;
  const [me, counts, company] = await Promise.all([
    accountMe(),
    getOrderTabCounts().catch(() => null),
    accountCompany(),
  ]);
  return (
    // Project B: the storefront's width and gutters; the account menu a sticky column on a wide screen.
    <div className="max-w-nav mx-auto px-5 pt-3 pb-16 md:px-8 md:pb-20 lg:pt-7 xl:px-12">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <AccountNav me={me} todo={counts?.todo ?? 0} company={company} />
        <div className="min-w-0">
          <AccountTabs team={company !== null} />
          {children}
        </div>
      </div>
    </div>
  );
}

async function accountMe(): Promise<AccountMe> {
  const [actor, points, credit, format] = await Promise.all([
    getActor("customer").catch(() => null),
    getPoints().catch(() => null),
    getStoreCredit().catch(() => null),
    getFormat(),
  ]);
  return {
    name: actor?.displayName ?? null,
    points: points ? format.number(points.availablePoints) : null,
    credit: credit ? format.thb(credit.balance) : null,
  };
}

/** The member's company for the nav, or `null` — a failed read hides it, never the page. */
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
