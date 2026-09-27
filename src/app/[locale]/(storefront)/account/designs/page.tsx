import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

import { listMyDesigns } from "@/features/customer/designer/api.server";
import { getActor } from "@/lib/auth/actor";

import MyDesigns from "./MyDesigns";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("designs");
  return { title: t("title") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Signed in: the account's designs (F4 C.1). A guest's stay in this browser until sign-in.
  const actor = await getActor("customer");
  const account = actor ? await listMyDesigns() : null;

  // The header, footer and bottom nav come from `(storefront)/layout.tsx`.
  return <MyDesigns account={account} />;
}
