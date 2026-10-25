"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { configureHref } from "@/features/customer/catalog/paths";
import { studioHref } from "@/features/customer/studio/paths";
import { recipeOfVariant } from "@/features/customer/studio/variant-recipe";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";

import { variantRfqHref } from "./paths";

type Variant = { code: string; options: Record<string, unknown>; pricePath: "instant" | "rfq" };

export interface VariantActionsProps {
  /** The base the variants belong to (`PK-TE-01`). */
  base: string;
  variant: Variant;
  /** The catalogue product the style is priced through: the configurator and the studio's product. */
  productSlug: string | null;
  /** The style's RFQ form (`/rfq/<category>?type=<productType>`), or `null` when it has none yet. */
  rfqHref: string | null;
  /** Told which way the customer went — the library counts its calls to action (`catalog_cta`). */
  onAction?: (action: "design" | "cart" | "quote") => void;
}

/**
 * What a customer can do with the chosen variant (D-407): every shown variant opens in the 3D
 * studio on its own shape — closures, inserts, windows — and is either priced at once
 * (configure) or quoted (a request for quotation carrying the variant code). The engine's library
 * is loaded only when the studio is asked for, not with the page.
 */
export function VariantActions({ base, variant, productSlug, rfqHref, onAction }: VariantActionsProps) {
  const t = useTranslations("styles.detail");
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [noStudio, setNoStudio] = useState<string | null>(null);
  // Priced at once only through the product the configurator prices; otherwise quoted.
  const instant = variant.pricePath === "instant" && productSlug !== null;

  async function openStudio() {
    onAction?.("design");
    setOpening(true);
    const found = await recipeOfVariant(base, variant.options).catch(() => null);
    const [l, w, h] = [found?.values.length, found?.values.width, found?.values.height];
    if (!found || typeof l !== "number" || typeof w !== "number" || typeof h !== "number") {
      setNoStudio(variant.code);
      setOpening(false);
      return;
    }
    router.push(
      studioHref({
        product: productSlug,
        style: found.recipe.id,
        dims: { l, w, h },
        variant: { base, code: variant.code, key: found.key },
        step: "box",
      }),
    );
  }

  const studioButton = (
    <Button
      variant={instant ? "secondary" : "primary"}
      iconStart="sparkles"
      loading={opening}
      onClick={() => void openStudio()}
    >
      {t("designInStudio")}
    </Button>
  );
  const quote = (
    <Button asChild variant="secondary">
      <Link href={variantRfqHref(rfqHref, base, variant.code)} onClick={() => onAction?.("quote")}>
        {t("requestQuote")}
      </Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-2">
      {!instant ? <p className="text-muted text-sm">{t("rfqNote")}</p> : null}
      <div className="flex flex-wrap gap-2">
        {instant ? (
          <Button asChild>
            <Link href={configureHref(productSlug!)} onClick={() => onAction?.("cart")}>
              {t("configure")}
            </Link>
          </Button>
        ) : null}
        {noStudio === variant.code ? null : studioButton}
        {instant ? null : quote}
      </div>
      {noStudio === variant.code ? (
        <p className="text-muted text-sm" role="status">
          {t("studioUnavailable")}
        </p>
      ) : null}
    </div>
  );
}
