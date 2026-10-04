"use client";

import { useLocale, useTranslations } from "next-intl";

import type { StyleCard } from "@/features/customer/catalog/api.server";
import { useFormat } from "@/features/shared/format/useFormat";

import { StyleCardActions } from "./StyleCardActions";
import { cardWords, StyleCardFace } from "./StyleCardFace";

/** A card rendered in the browser — for the pages "show more" brings in; loaded with the first of them. */
export default function StyleCardView({
  style,
  signedIn,
  signInHref,
}: {
  style: StyleCard;
  signedIn: boolean;
  signInHref: string;
}) {
  const t = useTranslations("styles");
  const locale = useLocale();
  const format = useFormat();
  const words = cardWords(style, locale, t as never, { thb: (a) => format.thb(a), number: (n) => format.number(n) });
  return (
    <StyleCardFace
      style={style}
      words={words}
      actions={<StyleCardActions code={style.code} name={words.name} signedIn={signedIn} signInHref={signInHref} />}
    />
  );
}
