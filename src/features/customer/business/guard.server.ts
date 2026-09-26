import "server-only";

import { getLocale } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { redirect } from "@/i18n/navigation";

import { getMyCompany, type Company } from "./api.server";

/** A company page: signed in, and a member — otherwise the business landing, which explains. */
export async function requireMember(): Promise<Company> {
  await requireCustomer();
  const company = await getMyCompany();
  if (company) return company;
  return redirect({ href: "/business", locale: await getLocale() });
}
