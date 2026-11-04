"use client";

import { useTranslations } from "next-intl";

import { SectionNav, useCan } from "../console";

/** The sales agent desk's sections (D-416 – D-423). */
export function AgentsNav() {
  const t = useTranslations("agents.nav");
  // The waiting list is personal data (`agent_waitlist.read`, P7): only the roles that may read it see its tab.
  const canSeeWaitlist = useCan("agent_waitlist.read");
  return (
    <SectionNav
      label={t("label")}
      items={[
        { href: "/agents", label: t("agents"), exact: true },
        { href: "/agents/applications", label: t("applications") },
        { href: "/agents/commissions", label: t("commissions") },
        { href: "/agents/statements", label: t("statements") },
        { href: "/agents/tax-declarations", label: t("taxDeclarations") },
        { href: "/agents/payout-profiles", label: t("payoutProfiles") },
        { href: "/agents/links", label: t("links") },
        { href: "/agents/leads", label: t("leads") },
        { href: "/agents/factories", label: t("factories") },
        { href: "/agents/plans", label: t("plans") },
        ...(canSeeWaitlist ? [{ href: "/agents/waitlist", label: t("waitlist") }] : []),
      ]}
    />
  );
}
