import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getCartAndBook } from "@/features/customer/cart/api.server";
import { CheckoutView } from "@/features/customer/checkout/CheckoutView";
import { Link, redirect } from "@/i18n/navigation";
import { Callout } from "@/ui/components/Callout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("checkout");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Checkout (F3 3.3). Only a cart the API says is ready can be checked out. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const [me, { locale }] = await Promise.all([requireCustomer(), params]);
  const [t, { cart, addresses, taxProfiles }] = await Promise.all([getTranslations("checkout"), getCartAndBook()]);
  if (cart.items.length === 0) return redirect({ href: "/cart", locale });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/cart" className="text-primary text-sm underline-offset-4 hover:underline">
        {t("backToCart")}
      </Link>
      <h1 className="mt-2 text-2xl font-bold md:text-3xl">{t("title")}</h1>
      {!cart.readyForCheckout ? (
        <Callout tone="warning" className="mt-4">
          {t("cartNotReady")}
        </Callout>
      ) : null}
      <CheckoutView
        contact={{ name: me.displayName, phone: me.phone ?? "", email: me.email ?? "" }}
        addresses={addresses}
        taxProfiles={taxProfiles}
        cartSplits={cart.items.some((item) => item.destinations.length > 1)}
      />
    </div>
  );
}
