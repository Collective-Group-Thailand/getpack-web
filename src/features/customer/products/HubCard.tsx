import { getLocale, getTranslations } from "next-intl/server";

import { storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { productHref, stockProductHref } from "@/features/customer/catalog/paths";
import { STOCK_AVAILABILITY, stockAvailabilityOf } from "@/domain/status";
import { displayPrice, type PriceDisplay } from "@/features/shared/format/price";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { ProductCard } from "@/ui/components/ProductCard";
import { productFamilyOf } from "@/ui/components/ProductIllustration";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { Icon } from "@/ui/icons";

import { stockCartable, type HubItem } from "./hub";
import { RfqToggle } from "./RfqToggle";
import { StockCartButton } from "./StockCartButton";

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
  const labels = { incl: tCatalog("price.vatIncluded"), excl: tCatalog("price.vatExcluded") };
  // Both of the API's figures (D-447 §10.6), each with its own label; the page's switch shows one (`VatFigure`).
  const incl =
    item.startingPrice !== null ? displayPrice({ incl: item.startingPrice }, "incl", format.thb, labels) : null;
  const excl =
    incl && item.startingPriceExVat !== null
      ? displayPrice({ excl: item.startingPriceExVat }, "excl", format.thb, labels)
      : null;
  const price = incl;
  const fallbackText =
    item.mode === "service" ? t("card.service") : item.mode === "stock" ? t("card.stockPrice") : t("card.quote");
  const moq = item.moq !== null ? t("card.moq", { quantity: item.moq, unit }) : null;
  const lead = item.leadTime
    ? item.leadTime.min === item.leadTime.max
      ? t("card.leadExact", { days: item.leadTime.min })
      : t("card.leadRange", { min: item.leadTime.min, max: item.leadTime.max })
    : null;
  const cartLabel =
    stockCartable(item) && item.priceQuantity !== null
      ? t("card.addToCart", { quantity: item.priceQuantity, unit })
      : null;
  return { t, format, unit, price, figures: { incl, excl }, fallbackText, moq, lead, cartLabel };
}

/**
 * One price as the "ราคารวม VAT / ไม่รวม VAT" switch shows it (D-447 §10.6): with both of the API's figures, each is
 * drawn and marked (`data-vat-figure`), and the page's choice (`data-vat-basis` on the root, `HubVatSwitch`) hides the
 * other — VAT-inclusive by default, so the server's page is right before any script runs. With one figure, that one.
 */
export function VatFigure({
  figures,
  render,
}: {
  figures: { incl: PriceDisplay | null; excl: PriceDisplay | null };
  render: (price: PriceDisplay) => React.ReactNode;
}) {
  if (!figures.incl) return null;
  if (!figures.excl) return <>{render(figures.incl)}</>;
  return (
    <>
      <span data-vat-figure="incl" className="contents">
        {render(figures.incl)}
      </span>
      <span data-vat-figure="excl" className="contents">
        {render(figures.excl)}
      </span>
    </>
  );
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
  const [locale, words, tStatus] = await Promise.all([getLocale(), itemWords(item), getTranslations("status")]);
  const { t, unit, figures, fallbackText, moq, lead, cartLabel } = words;
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
        ) : item.kind === "stock" && item.inStock !== null ? (
          // D-447 §10.4: "พร้อมส่ง" / "สินค้าหมด" from the one status map.
          <StatusBadge
            meta={STOCK_AVAILABILITY[stockAvailabilityOf(item.inStock)]}
            label={tStatus(STOCK_AVAILABILITY[stockAvailabilityOf(item.inStock)].labelKey)}
          />
        ) : undefined
      }
      price={
        figures.incl ? (
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-muted text-[0.8125rem]">{t("card.from")}</span>
            <VatFigure
              figures={figures}
              render={(price) => (
                <>
                  <span className="text-primary text-xl leading-tight font-semibold tabular-nums md:text-[1.375rem]">
                    {price.amount}
                  </span>
                  <span className="text-muted text-sm">
                    {item.priceQuantity === null
                      ? t("card.perUnitOnly", { unit })
                      : item.kind === "stock"
                        ? t("card.perUnitMin", { unit, quantity: item.priceQuantity })
                        : t("card.perUnit", { unit, quantity: item.priceQuantity })}
                  </span>
                  <span className="text-muted text-xs">{price.vatLabel}</span>
                </>
              )}
            />
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
        ) : cartLabel && item.id && item.priceQuantity !== null ? (
          // D-447 §10.2: a stock item on hand with an instant price — the cart and the quote tray both.
          <div className="flex flex-col gap-2 *:w-full">
            <StockCartButton stockProductId={item.id} quantity={item.priceQuantity} name={name} label={cartLabel} />
            <RfqToggle item={trayItemOf(item)} name={name} size="sm" />
          </div>
        ) : (
          <RfqToggle item={trayItemOf(item)} name={name} size="sm" />
        )
      }
    />
  );
}
