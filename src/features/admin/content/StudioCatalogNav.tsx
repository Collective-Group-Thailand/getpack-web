"use client";

import { useTranslations } from "next-intl";

import { SectionNav } from "../console";

export const STUDIO_CATALOG_HREF = "/studio-catalog";

/** The studio catalogue's screens (D-412): the design templates and the shapes, icons and marks. */
export function StudioCatalogNav() {
  const t = useTranslations("content.nav");
  return (
    <SectionNav
      label={t("label")}
      items={[
        { href: STUDIO_CATALOG_HREF, label: t("templates"), exact: true },
        { href: `${STUDIO_CATALOG_HREF}/elements`, label: t("elements") },
      ]}
    />
  );
}
