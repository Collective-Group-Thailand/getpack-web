"use client";

import { useTranslations } from "next-intl";

import { SectionNav } from "../console";

/** The sales agent desk's sections (D-416 – D-423). */
export function AgentsNav() {
  const t = useTranslations("agents.nav");
  return (
    <SectionNav
      label={t("label")}
      items={[
        { href: "/agents", label: t("agents"), exact: true },
        { href: "/agents/applications", label: t("applications") },
        { href: "/agents/commissions", label: t("commissions") },
        { href: "/agents/statements", label: t("statements") },
        { href: "/agents/links", label: t("links") },
        { href: "/agents/leads", label: t("leads") },
        { href: "/agents/factories", label: t("factories") },
        { href: "/agents/plans", label: t("plans") },
      ]}
    />
  );
}
