"use client";

import { useTranslations } from "next-intl";

import { SectionNav } from "../console";

export function MarketingNav() {
  const t = useTranslations("marketing.nav");
  return (
    <SectionNav
      label={t("label")}
      items={[
        { href: "/marketing", label: t("campaigns"), exact: true },
        { href: "/marketing/promotions", label: t("promotions") },
        { href: "/marketing/referrals", label: t("referrals") },
        { href: "/marketing/loyalty", label: t("loyalty"), permission: "settings.read" },
      ]}
    />
  );
}
