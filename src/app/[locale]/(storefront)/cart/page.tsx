import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getCartAndBook } from "@/features/customer/cart/api.server";
import { CartView } from "@/features/customer/cart/CartView";
import { GuestCartView } from "@/features/customer/cart/GuestCartView";
import { getActor } from "@/lib/auth/actor";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cart");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * The cart (F3 3.3). A guest sees what they kept in this browser and signs in at checkout — the
 * only step that needs an account (UX audit Flow 1, bug #3); the account's cart then takes those
 * lines in.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const [actor, t] = await Promise.all([getActor("customer"), getTranslations("cart"), params]);
  if (!actor) {
    return (
      <div className="max-w-content mx-auto px-5 py-8 md:px-8">
        <h1 className="text-[2rem] leading-tight md:text-[2.375rem]">{t("title")}</h1>
        <GuestCartView signInHref={`/sign-in?returnTo=${encodeURIComponent("/cart")}`} />
      </div>
    );
  }
  const { cart, addresses } = await getCartAndBook();
  return (
    <div className="max-w-content mx-auto px-5 py-8 md:px-8">
      <h1 className="text-[2rem] leading-tight md:text-[2.375rem]">{t("title")}</h1>
      <CartView initialCart={cart} initialAddresses={addresses} />
    </div>
  );
}
