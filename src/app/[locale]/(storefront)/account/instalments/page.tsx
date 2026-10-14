import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { InstalmentList } from "@/features/customer/checkout/InstalmentList";
import { serverApi } from "@/lib/api/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("instalments");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The instalment centre (F3 3.3). */
export default async function Page() {
  await requireCustomer();
  const [t, instalments] = await Promise.all([
    getTranslations("instalments"),
    (await serverApi("customer"))
      .GET("/v1/store/instalments", { params: { query: { perPage: 100 } } })
      .then(({ data }) => data!.data),
  ]);
  return (
    <div>
      <h1 className="text-title leading-tight">{t("title")}</h1>
      <p className="text-muted mt-1">{t("intro")}</p>
      <InstalmentList instalments={instalments} />
    </div>
  );
}
