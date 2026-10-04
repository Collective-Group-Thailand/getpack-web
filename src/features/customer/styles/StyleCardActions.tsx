"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";

import { useCompare } from "./compare-store";
import { useStyleFavourites } from "./useStyleFavourites";

/** Save and compare on a library card — the only part of a card that runs in the browser (U3.5 §4). */
export function StyleCardActions({
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
  const t = useTranslations("styles");
  const favourites = useStyleFavourites(signedIn);
  const compare = useCompare();
  const saved = favourites.has(code);
  const chosen = compare.has(code);
  return (
    <>
      {signedIn ? (
        <IconButton
          name="star"
          variant={saved ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={saved}
          loading={favourites.pending(code)}
          label={`${saved ? t("favourites.remove") : t("favourites.add")}: ${name}`}
          onClick={() => favourites.toggle(code)}
        />
      ) : (
        <IconButton asChild name="star" variant="ghost" size="sm" label={t("favourites.signIn")}>
          <Link href={signInHref} />
        </IconButton>
      )}
      <Button
        size="sm"
        variant={chosen ? "secondary" : "ghost"}
        iconStart="columns"
        aria-pressed={chosen}
        disabled={!chosen && compare.full}
        title={!chosen && compare.full ? t("compare.limit") : undefined}
        aria-label={`${chosen ? t("compare.remove") : t("compare.add")}: ${name}`}
        onClick={() => compare.toggle(code)}
      >
        {t("compare.add")}
      </Button>
    </>
  );
}
