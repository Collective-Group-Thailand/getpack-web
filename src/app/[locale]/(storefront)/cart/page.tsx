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
      <div className="max-w-nav mx-auto px-5 pt-6 pb-16 md:px-8 md:pt-8 md:pb-20 xl:px-12">
        <h1 className="text-[1.75rem] leading-[1.15] font-semibold tracking-tight md:text-[2.25rem]">{t("title")}</h1>
        <GuestCartView signInHref={`/sign-in?returnTo=${encodeURIComponent("/cart")}`} />
      </div>
    );
  }
  const { cart } = await getCartAndBook();
  // Step 1 of 4 (checkout redesign Phase 1): the stepper, then the cart box, whose heading is the page's h1.
  return (
    <div className="max-w-nav mx-auto px-5 pt-1 pb-8 md:px-8 xl:px-12">
      {cart.items.length === 0 ? (
        <h1 className="mt-7 text-[1.75rem] leading-[1.15] font-semibold tracking-tight md:text-[2.25rem]">
          {t("title")}
        </h1>
      ) : null}
      <CartView initialCart={cart} />
    </div>
  );
}
