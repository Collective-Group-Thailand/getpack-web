"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Checkbox } from "@/ui/components/Checkbox";
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

/** "เปรียบเทียบ" on a library card: a checkbox; past the limit it stays off and says why. */
export function CompareToggle({ code, name }: { code: string; name: string }) {
  const t = useTranslations("styles.library");
  const compare = useCompare();
  const chosen = compare.has(code);
  return (
    <Checkbox
      size="sm"
      className="shrink-0"
      checked={chosen}
      aria-label={`${t("compare")}: ${name}`}
      label={t("compare")}
      onCheckedChange={() => {
        if (!compare.toggle(code)) {
          toast(t("compareLimit", { limit: compare.limit }));
          return;
        }
        if (!chosen) trackCatalog("catalog_compare", { style_codes: [...compare.codes, code] });
      }}
    />
  );
}
