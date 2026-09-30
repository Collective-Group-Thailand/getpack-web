import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AddressBook } from "@/features/customer/account/AddressBook";
import { getAddressBook } from "@/features/customer/account/api.server";
import { requireCustomer } from "@/features/customer/auth/guard.server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.book");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Addresses and tax-invoice profiles (F3 3.4). */
export default async function Page() {
  await requireCustomer();
  const [t, { addresses, taxProfiles }] = await Promise.all([getTranslations("account.book"), getAddressBook()]);
  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted mt-1 mb-6">{t("intro")}</p>
      <AddressBook addresses={addresses} taxProfiles={taxProfiles} />
    </div>
  );
}
