"use client";

import { useTranslations } from "next-intl";

import { SectionNav } from "../console";

export function PartnersNav() {
  const t = useTranslations("partners.nav");
  return (
    <SectionNav
      label={t("label")}
      items={[
        { href: "/partners", label: t("factories"), exact: true },
        { href: "/partners/proposals", label: t("proposals") },
        { href: "/partners/requests", label: t("requests") },
        { href: "/partners/coverage", label: t("coverage") },
        { href: "/partners/indices", label: t("indices") },
        { href: "/partners/boards", label: t("boards") },
      ]}
    />
  );
}
