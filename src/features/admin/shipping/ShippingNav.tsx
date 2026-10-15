"use client";

import { useTranslations } from "next-intl";

import { SectionNav } from "../console";

export const SHIPPING_HREF = "/shipping";

/** The shipping set-up desk (D-413): customer rates, zones, carriers and the business calendar. */
export function ShippingNav() {
  const t = useTranslations("shipping.nav");
  return (
    <SectionNav
      label={t("label")}
      items={[
        { href: SHIPPING_HREF, label: t("rates"), exact: true, permission: "shipping_rates.read" },
        { href: `${SHIPPING_HREF}/zones`, label: t("zones"), permission: "partners.read" },
        { href: `${SHIPPING_HREF}/carriers`, label: t("carriers"), permission: "carriers.read" },
        { href: `${SHIPPING_HREF}/calendar`, label: t("calendar") },
      ]}
    />
  );
}
