"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { IconButton } from "@/ui/components/IconButton";
import { toast } from "@/ui/components/Toast";

import { trackCatalog } from "@/lib/analytics/catalog";
import { useCompare } from "./compare-store";
import { useStyleFavourites } from "./useStyleFavourites";

const plate = "bg-surface/95 border-border border shadow-sm";

/**
 * Save on a library card — the heart over its picture (D-246). A guest is sent to sign in and back
 * (`signInHref`); a saved style's heart stays visible at rest.
 */
export function FavouriteToggle({
  code,
  name,
  signedIn,
  signInHref,
}: {
  code: string;
  name: string;
  signedIn: boolean;
  signInHref: string;
}) {
  const t = useTranslations("styles.library");
  const favourites = useStyleFavourites(signedIn);
  const saved = favourites.has(code);
  if (!signedIn)
    return (
      <IconButton asChild name="heart" variant="ghost" size="sm" label={t("favouriteSignIn")} className={plate}>
        <Link href={signInHref} />
      </IconButton>
    );
  return (
    <IconButton
      name="heart"
      variant={saved ? "secondary" : "ghost"}
      size="sm"
      aria-pressed={saved}
      loading={favourites.pending(code)}
      label={saved ? t("favouriteRemove", { name }) : t("favouriteAdd", { name })}
      className={plate}
      onClick={() => favourites.toggle(code)}
    />
  );
}

/**
 * "เปรียบเทียบ" on a library card (owner redesign 2026-10-30): a small toggle over the picture's top corner, beside
 * the heart — shown on hover or focus with a mouse, always on touch, and kept in view while chosen. Past the limit
 * it stays off and says why. It hands the tray the style's name and photo, so the tray shows the product.
 */
export function CompareToggle({
  code,
  name,
  image = null,
  family = "tuck",
}: {
  code: string;
  name: string;
  image?: string | null;
  family?: string;
}) {
  const t = useTranslations("styles.library");
  const compare = useCompare();
  const chosen = compare.has(code);
  return (
    <IconButton
      name={chosen ? "check" : "columns"}
      variant={chosen ? "primary" : "ghost"}
      size="sm"
      aria-pressed={chosen}
      label={`${t("compare")}: ${name}`}
      className={chosen ? undefined : plate}
      onClick={() => {
        if (!compare.toggle(code, { name, image, family })) {
          toast(t("compareLimit", { limit: compare.limit }));
          return;
        }
        if (!chosen) trackCatalog("catalog_compare", { style_codes: [...compare.codes, code] });
      }}
    />
  );
}
