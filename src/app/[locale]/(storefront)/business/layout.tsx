import { cookies } from "next/headers";

import { getMyCompany } from "@/features/customer/business/api.server";
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
  return (
    <div className="max-w-content mx-auto w-full px-5 py-8 md:px-8">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <BusinessNav can={company.can} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
