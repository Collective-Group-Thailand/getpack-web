import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { getApprovals, getMyCompany } from "@/features/customer/business/api.server";
import { BusinessNav } from "@/features/customer/business/BusinessNav";
import { readAccessToken } from "@/lib/auth/session";

/**
 * getpack for business's frame (F3 3.7): the company's sections beside each page once the visitor
 * is a member; otherwise the page frames itself (the landing full-bleed, C10). Pages guard themselves.
 */
export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const company = readAccessToken(await cookies()) ? await getMyCompany() : null;
  // A visitor's pages frame themselves: the landing runs full-bleed (its dark hero), sign-up keeps the column.
  if (!company) return children;
  // Project C: the account's frame — width, gutters and the menu column — so the company reads as part of it.
  const [roles, pending] = await Promise.all([
    getTranslations("business.members.roles"),
    company.can.approveOrders ? getApprovals(company.id).catch(() => null) : Promise.resolve(null),
  ]);
  return (
    <div className="max-w-nav mx-auto w-full px-5 pt-3 pb-16 md:px-8 md:pb-20 lg:pt-7 xl:px-12">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <BusinessNav
          can={company.can}
          company={{
            name: company.tradeName ?? company.legalName,
            roles: company.myRoles.map((role) => roles(role)).join(", "),
          }}
          pending={pending?.length ?? 0}
        />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
