import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getPoints } from "@/features/customer/account/api.server";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { findMyCompany } from "@/features/customer/business/companies.server";
import { getCartAndBook } from "@/features/customer/cart/api.server";
import { getPublicConfig } from "@/features/customer/catalog/api.server";
import { CheckoutView } from "@/features/customer/checkout/CheckoutView";
import { redirect } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("checkout");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Checkout, steps 2–4 (checkout redesign Phase 1, F3 3.3): `?step=address|payment|review` on one page. The preview
 * refuses a cart that is not ready; the view says why on the step it belongs to.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const [, { locale }] = await Promise.all([requireCustomer(), params]);
  const [t, { cart, addresses, taxProfiles }, points, company, config] = await Promise.all([
    getTranslations("checkout"),
    getCartAndBook(),
    getPoints(),
    findMyCompany(),
    getPublicConfig(),
  ]);
  if (cart.items.length === 0) return redirect({ href: "/cart", locale });
  // Tax invoices are issued in the name from settings (CLAUDE.md, D-010); none set → the line names no company.
  const issuer = config?.issuer ?? null;
  const issuerName = (locale === "en" ? issuer?.legalNameEn : issuer?.legalNameTh) ?? issuer?.legalNameTh ?? null;

  return (
    <div className="max-w-nav mx-auto px-4 pt-1 pb-8 md:px-5 min-[65rem]:px-6">
      <h1 className="sr-only">{t("title")}</h1>
      <CheckoutView
        cart={cart}
        addresses={addresses}
        taxProfiles={taxProfiles}
        pointsBalance={points.availablePoints}
        company={company?.status === "active" ? company : null}
        issuerName={issuerName}
      />
    </div>
  );
}
