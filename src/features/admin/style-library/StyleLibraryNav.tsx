"use client";

import { useTranslations } from "next-intl";

import { SectionNav } from "../console";
import { LIBRARY_HREF } from "./resources";

/** The desk's screens (D-411): the bases, imports, coverage, rules, fit ranges, page content (C1c) and what customers look for. */
export function StyleLibraryNav() {
  const t = useTranslations("styleLibrary.nav");
  return (
    <SectionNav
      label={t("label")}
      items={[
        { href: LIBRARY_HREF, label: t("styles"), exact: true },
        { href: `${LIBRARY_HREF}/imports`, label: t("imports") },
        { href: `${LIBRARY_HREF}/coverage`, label: t("coverage") },
        { href: `${LIBRARY_HREF}/rules`, label: t("rules") },
        { href: `${LIBRARY_HREF}/fit-ranges`, label: t("fitRanges"), permission: "styles.curate" },
        { href: `${LIBRARY_HREF}/content`, label: t("content") },
        { href: `${LIBRARY_HREF}/studio-featured`, label: t("studioFeatured"), permission: "settings.read" },
        { href: `${LIBRARY_HREF}/next-styles`, label: t("nextStyles"), permission: "analytics.read" },
      ]}
    />
  );
}
