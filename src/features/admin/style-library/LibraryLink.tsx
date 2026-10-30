"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/ui/components/Button";

import { LIBRARY_HREF } from "./resources";

/**
 * The next step out of an empty table on the style desk: back to the bases, or to the imports that bring new
 * bases, recipes and variants in. Outlined — an empty state never carries the page's filled action.
 */
export function LibraryLink({ to }: { to: "library" | "imports" }) {
  const t = useTranslations("styleLibrary.nav");
  return (
    <Button variant="secondary" asChild>
      <Link href={to === "library" ? LIBRARY_HREF : `${LIBRARY_HREF}/imports`}>
        {to === "library" ? t("openLibrary") : t("openImports")}
      </Link>
    </Button>
  );
}
