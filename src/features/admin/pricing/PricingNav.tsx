"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { SectionNav, useCan } from "../console";

const SECTIONS = [
  { href: "/pricing/margins", key: "margins", permission: "margin.read" },
  { href: "/pricing/payment-schedules", key: "schedules", permission: "orders.read" },
  { href: "/pricing/guarantee", key: "guarantee", permission: "guarantee_policies.read" },
] as const;

/** The pricing and policies desk's sections (D-424), each behind the permission that reads it. */
export function PricingNav() {
  const t = useTranslations("pricing.nav");
  return (
    <SectionNav
      label={t("label")}
      items={SECTIONS.map((section) => ({ href: section.href, label: t(section.key), permission: section.permission }))}
    />
  );
}

/** `/pricing` opens the first section this person may read. */
export function PricingHome() {
  const t = useTranslations("pricing.nav");
  const router = useRouter();
  const margins = useCan("margin.read");
  const schedules = useCan("orders.read");
  const guarantee = useCan("guarantee_policies.read");
  const target = margins ? SECTIONS[0] : schedules ? SECTIONS[1] : guarantee ? SECTIONS[2] : null;
  useEffect(() => {
    if (target) router.replace(target.href);
  }, [router, target]);
  return target ? null : <p className="text-muted text-sm">{t("nothing")}</p>;
}
