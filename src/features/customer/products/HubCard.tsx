import { getLocale, getTranslations } from "next-intl/server";

import { storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { productHref, stockProductHref } from "@/features/customer/catalog/paths";
import { displayPrice, figuresOf } from "@/features/shared/format/price";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { ProductCard } from "@/ui/components/ProductCard";
import { productFamilyOf } from "@/ui/components/ProductIllustration";
import { Icon } from "@/ui/icons";

import type { HubItem } from "./hub";
import { RfqToggle } from "./RfqToggle";

export const itemHref = (item: Pick<HubItem, "kind" | "key">) =>
  item.kind === "stock" ? stockProductHref(item.key) : productHref(item.key);

/** The tray's copy of an item: its product reference (DECISIONS-STAGE-A §4), type, category and names. */
export const trayItemOf = (item: HubItem) => ({
  kind: item.kind,
  key: item.key,
  productTypeCode: item.productTypeCode,
  categoryCode: item.categoryCode,
  nameTh: item.nameTh,
  nameEn: item.nameEn,
});

/** The words a card and a table row share: the unit, the price block's pieces, MOQ and lead time. */
export async function itemWords(item: HubItem) {
  const [t, tCatalog, format] = await Promise.all([
    getTranslations("products"),
    getTranslations("catalog"),
    getFormat(),
  ]);
  // A catalogue card names no unit; the catalogue sells made-to-order work by the piece (catalog `price.perPiece`).
  const unit = tCatalog(`stock.units.${item.unit ?? "piece"}`);
  const price =
    item.startingPrice !== null
      ? displayPrice(figuresOf(item.startingPrice), "incl", format.thb, {
          incl: tCatalog("price.vatIncluded"),
          excl: tCatalog("price.vatExcluded"),
        })
      : null;
  const fallbackText =
    item.mode === "service" ? t("card.service") : item.mode === "stock" ? t("card.stockPrice") : t("card.quote");
  const moq = item.moq !== null ? t("card.moq", { quantity: item.moq, unit }) : null;
  const lead = item.leadTime
    ? item.leadTime.min === item.leadTime.max
      ? t("card.leadExact", { days: item.leadTime.min })
      : t("card.leadRange", { min: item.leadTime.min, max: item.leadTime.max })
    : null;
  return { t, format, unit, price, fallbackText, moq, lead };
}

/**
 * One product on the hub (prompt item 6, prototype `.card`): the 4:3 picture with a badge only for
 * ราคาทันที (amber) and พร้อมส่ง (green), the category, the name on two lines, the price block from the
 * API's figures, the MOQ and lead time when the API has them, and one action — "ดูราคาและสั่งซื้อ"
 * for an instant item, the "เพิ่มในใบขอราคา" toggle for the rest. Cards in a row share their height
 * (the grid stretches them; the foot sits at the bottom).
 */
export async function HubCard({
  item,
  categoryName,
  priority = false,
}: {
  item: HubItem;
  categoryName: string | null;
  priority?: boolean;
}) {
  const [locale, words] = await Promise.all([getLocale(), itemWords(item)]);
  const { t, unit, price, fallbackText, moq, lead } = words;
  const name = pick(locale, item.nameTh, item.nameEn);
  const src = storeImageSrc(item.imageUrl, "thumb");
  const alt = item.imageAlt ? pick(locale, item.imageAlt.th, item.imageAlt.en ?? item.imageAlt.th) : name;
  const href = itemHref(item);
  return (
    <ProductCard
      as="li"
      roomy
      reserveTitleLines
      priority={priority}
      title={<Link href={href}>{name}</Link>}
      topLine={categoryName ?? undefined}
      image={src ? { src, alt } : null}
      fallback={{
        family: item.kind === "stock" ? "stock" : productFamilyOf(`${item.productTypeCode ?? ""} ${item.key}`),
        tone: "kraft",
      }}
      badges={
        item.mode === "instant" ? (
          <Badge tone="instant" icon="zap">
            {t("card.instantBadge")}
          </Badge>
        ) : item.mode === "stock" && item.inStock ? (
          <Badge tone="primary" icon="check">
            {t("card.stockBadge")}
          </Badge>
        ) : undefined
      }
      price={
        price ? (
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-muted text-[0.8125rem]">{t("card.from")}</span>
            <span className="text-primary text-xl leading-tight font-semibold tabular-nums md:text-[1.375rem]">
              {price.amount}
            </span>
            <span className="text-muted text-sm">
              {item.priceQuantity !== null
                ? t("card.perUnit", { unit, quantity: item.priceQuantity })
                : t("card.perUnitOnly", { unit })}
            </span>
            <span className="text-muted text-xs">{price.vatLabel}</span>
          </span>
        ) : (
          <span className="text-fg text-sm font-semibold">{fallbackText}</span>
        )
      }
      meta={
        moq || lead ? (
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            {moq ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="layers" size={14} aria-hidden="true" />
                {moq}
              </span>
            ) : null}
            {lead ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="clock" size={14} aria-hidden="true" />
                {lead}
              </span>
            ) : null}
          </span>
        ) : undefined
      }
      action={
        item.mode === "instant" ? (
          <Button asChild size="sm">
            <Link href={href}>{t("card.buy")}</Link>
          </Button>
        ) : (
          <RfqToggle item={trayItemOf(item)} name={name} size="sm" />
        )
      }
    />
  );
}
