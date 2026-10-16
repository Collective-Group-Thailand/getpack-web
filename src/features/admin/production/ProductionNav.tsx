"use client";

import { useTranslations } from "next-intl";

import { SectionNav } from "../console";

export function ProductionNav() {
  const t = useTranslations("production.nav");
  return (
    <SectionNav
      label={t("label")}
      items={[
        { href: "/production", label: t("board"), exact: true },
        { href: "/production/inspections", label: t("inspections") },
        { href: "/production/scorecards", label: t("scorecards"), permission: "partners.read" },
        { href: "/production/tooling", label: t("tooling") },
        { href: "/production/routes", label: t("routes") },
      ]}
    />
  );
}
