import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getProductTypes } from "@/features/customer/catalog/api.server";
import { RequestStructure } from "@/features/customer/structural/RequestStructure";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("styles.request");
  return { title: t("newTitle"), robots: { index: false, follow: false } };
}

/** "ไม่เจอแบบที่ต้องการ" — ask Packio's structural designers for a box (U3.6, D-273). Signed in. */
export default async function Page() {
  await requireCustomer();
  const [t, locale, types] = await Promise.all([getTranslations("styles.request"), getLocale(), getProductTypes()]);
  const options = types.map((type) => ({ value: type.code, label: locale === "en" ? type.nameEn : type.nameTh }));
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">{t("newTitle")}</h1>
      <p className="text-muted mt-1 mb-6">{t("newIntro")}</p>
      <RequestStructure productTypes={options} />
    </div>
  );
}
