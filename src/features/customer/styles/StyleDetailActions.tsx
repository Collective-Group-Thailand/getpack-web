"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";

import { useCompare } from "./compare-store";
import { CompareTray } from "./CompareTray";
import { useStyleFavourites } from "./useStyleFavourites";

/** Save and compare on a style's page, and the compare tray (D-246). */
export function StyleDetailActions({
  code,
  signedIn,
  signInHref,
}: {
  code: string;
  signedIn: boolean;
  signInHref: string;
}) {
  const t = useTranslations("styles");
  const favourites = useStyleFavourites(signedIn);
  const compare = useCompare();
  const saved = favourites.has(code);
  return (
    <div className="flex flex-wrap gap-2">
      {signedIn ? (
        <Button
          variant={saved ? "secondary" : "ghost"}
          iconStart="star"
          aria-pressed={saved}
          loading={favourites.pending(code)}
          onClick={() => favourites.toggle(code)}
        >
          {saved ? t("favourites.remove") : t("favourites.add")}
        </Button>
      ) : (
        <Button asChild variant="ghost" iconStart="star">
          <Link href={signInHref}>{t("favourites.signIn")}</Link>
        </Button>
      )}
      <Button
        variant={compare.has(code) ? "secondary" : "ghost"}
        iconStart="columns"
        aria-pressed={compare.has(code)}
        disabled={!compare.has(code) && compare.full}
        onClick={() => compare.toggle(code)}
      >
        {compare.has(code) ? t("compare.remove") : t("compare.add")}
      </Button>
      <CompareTray />
    </div>
  );
}
