import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getCartAndBook } from "@/features/customer/cart/api.server";
import { CartView } from "@/features/customer/cart/CartView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cart");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The cart (F3 3.3). A cart is a customer's, so a guest signs in first. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await Promise.all([requireCustomer(), params]);
  const [t, { cart, addresses }] = await Promise.all([getTranslations("cart"), getCartAndBook()]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold md:text-3xl">{t("title")}</h1>
      <CartView initialCart={cart} initialAddresses={addresses} />
    </div>
  );
}
