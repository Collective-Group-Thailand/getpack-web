import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getPoints } from "@/features/customer/account/api.server";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { findMyCompany } from "@/features/customer/business/companies.server";
import { getCartAndBook } from "@/features/customer/cart/api.server";
import { lineBlockers } from "@/features/customer/cart/cart";
import { CheckoutView } from "@/features/customer/checkout/CheckoutView";
import { Link, redirect } from "@/i18n/navigation";
import { Callout } from "@/ui/components/Callout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("checkout");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Checkout (F3 3.3). The preview refuses a cart that is not ready; the page says so first. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const [, { locale }] = await Promise.all([requireCustomer(), params]);
  const [t, { cart, addresses, taxProfiles, typeNames }, points, company] = await Promise.all([
    getTranslations("checkout"),
    getCartAndBook(locale),
    getPoints(),
    findMyCompany(),
  ]);
  if (cart.items.length === 0) return redirect({ href: "/cart", locale });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/cart" className="text-primary text-sm underline-offset-4 hover:underline">
        {t("backToCart")}
      </Link>
      <h1 className="mt-2 text-2xl font-bold md:text-3xl">{t("title")}</h1>
      {cart.items.some((item) => lineBlockers(item).length > 0) ? (
        <Callout tone="warning" className="mt-4">
          {t("cartNotReady")}
        </Callout>
      ) : null}
      <CheckoutView
        cart={cart}
        addresses={addresses}
        taxProfiles={taxProfiles}
        pointsBalance={points.availablePoints}
        company={company?.status === "active" ? company : null}
        typeNames={typeNames}
      />
    </div>
  );
}
