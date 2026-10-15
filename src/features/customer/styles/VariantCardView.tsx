"use client";

import { useLocale, useTranslations } from "next-intl";

import type { StyleVariantCard } from "@/features/customer/catalog/api.server";

import type { StylesT } from "./labels";
import { VariantCardFace, variantWords } from "./VariantCardFace";

/** A variant card rendered in the browser — for the pages "show more" brings in. */
export default function VariantCardView({ card }: { card: StyleVariantCard }) {
  const t = useTranslations("styles") as unknown as StylesT;
  return <VariantCardFace card={card} words={variantWords(card, useLocale(), t)} />;
}
