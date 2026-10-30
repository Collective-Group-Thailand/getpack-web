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
    // Two quiet actions (Project A review): a list on a phone — each its own line, never one wrapped alone — and
    // one row from `sm`, both ghost buttons of the same size, aligned with the text above.
    <div className="-ms-3 flex flex-col items-start gap-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1">
      {signedIn ? (
        <Button
          variant={saved ? "secondary" : "ghost"}
          size="sm"
          iconStart="star"
          aria-pressed={saved}
          loading={favourites.pending(code)}
          onClick={() => favourites.toggle(code)}
        >
          {saved ? t("favourites.remove") : t("favourites.add")}
        </Button>
      ) : (
        <Button asChild variant="ghost" size="sm" iconStart="star">
          <Link href={signInHref}>{t("favourites.signIn")}</Link>
        </Button>
      )}
      <Button
        variant={compare.has(code) ? "secondary" : "ghost"}
        size="sm"
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
