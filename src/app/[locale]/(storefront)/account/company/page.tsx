import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";

/** `/account/company` is where customers look for their company (round 2, B2); it lives at `/business`. */
export default async function AccountCompanyPage() {
  return redirect({ href: "/business", locale: await getLocale() });
}
