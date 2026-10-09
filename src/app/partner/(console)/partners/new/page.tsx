import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PartnerForm } from "@/features/partner/erp/PartnerForm";
import { PartnerPage } from "@/features/partner/frame";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerErp.partners.form"))("newTitle") };
}

/** A new supplier or customer (D-317); `?kind=customer` starts as a customer. */
export default async function NewTradingPartnerPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const [{ kind }, t, tList] = await Promise.all([
    searchParams,
    getTranslations("partnerErp.partners.form"),
    getTranslations("partnerErp.partners"),
  ]);
  return (
    <PartnerPage title={t("newTitle")} back={{ href: "/partners", label: tList("title") }}>
      <PartnerForm initialKind={kind === "customer" ? "customer" : "supplier"} />
    </PartnerPage>
  );
}
