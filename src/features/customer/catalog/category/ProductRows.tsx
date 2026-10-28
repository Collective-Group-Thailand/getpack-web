import { getLocale, getTranslations } from "next-intl/server";

import type { ProductDetail } from "@/features/customer/catalog/api.server";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { configureHref } from "@/features/customer/catalog/paths";
import { itemHref, itemWords, trayItemOf, VatFigure } from "@/features/customer/products/HubCard";
import type { HubItem } from "@/features/customer/products/hub";
import { RfqToggle } from "@/features/customer/products/RfqToggle";
import { StockCartButton } from "@/features/customer/products/StockCartButton";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { kraftOf, ProductIllustration, productFamilyOf } from "@/ui/components/ProductIllustration";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import type { CategoryContent } from "./content";
import { specsOf, type ProductSpecs } from "./specs";

/** The chips under a row's description, from the API's detail; nothing the API does not say. */
export async function specChips(specs: ProductSpecs | null, surface: string | null): Promise<string[]> {
  const [t, locale] = await Promise.all([getTranslations("catalog.categoryPage.row"), getLocale()]);
  if (!specs) return [];
  const chips = [...specs.structures];
  if (specs.flutes.length) chips.push(t("flute", { flutes: specs.flutes.join(" · ") }));
  else if (specs.materials.length) {
    chips.push(pick(locale, specs.materials[0]!.th, specs.materials[0]!.en));
    if (specs.materials.length > 1) chips.push(t("more", { count: specs.materials.length - 1 }));
  }
  if (surface) chips.push(t("surface", { surface }));
  if (specs.standardSizes > 0)
    chips.push(t(specs.customSize ? "sizesCustom" : "sizes", { count: specs.standardSizes }));
  else if (specs.customSize) chips.push(t("custom"));
  return chips;
}

/** A product's short description: the approved content one, else the API's own text. */
export async function shortOf(
  item: HubItem,
  detail: ProductDetail | undefined,
  content: CategoryContent,
): Promise<{ text: string | null; surface: string | null }> {
  const [t, locale] = await Promise.all([getTranslations("catalog.categoryContent"), getLocale()]);
  const own = content.products?.[item.key];
  const key = `${content.categoryCode}.products.${item.key}`;
  const api = detail ? pick(locale, detail.descriptionTh ?? "", detail.descriptionEn ?? "") || null : null;
  return {
    text: own?.short && t.has(`${key}.short`) ? t(`${key}.short`) : api,
    surface: own?.surface && t.has(`${key}.surface`) ? t(`${key}.surface`) : null,
  };
}

/** The action of an item: instant → the configurator ("ปรับแต่งและดูราคา"); stock → cart + tray; others → tray. */
export async function ItemAction({ item, name, size = "md" }: { item: HubItem; name: string; size?: "sm" | "md" }) {
  const [t, words] = await Promise.all([getTranslations("catalog.categoryPage.row"), itemWords(item)]);
  if (item.mode === "instant" && item.kind === "catalog")
    return (
      <Button asChild size={size}>
        <Link href={configureHref(item.key)}>{t("configure")}</Link>
      </Button>
    );
  if (words.cartLabel && item.id && item.priceQuantity !== null)
    return (
      <div className="flex flex-col gap-2 *:w-full">
        <StockCartButton stockProductId={item.id} quantity={item.priceQuantity} name={name} label={words.cartLabel} />
        <RfqToggle item={trayItemOf(item)} name={name} size={size} />
      </div>
    );
  return <RfqToggle item={trayItemOf(item)} name={name} size={size} />;
}

/** The price block of an item (both VAT figures when the API sent both), or its mode's words. */
export async function ItemPrice({ item, large = false }: { item: HubItem; large?: boolean }) {
  const { t: tProducts, unit, figures, fallbackText } = await itemWords(item);
  if (!figures.incl) return <span className="text-fg text-sm font-semibold">{fallbackText}</span>;
  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5">
      <span className="text-muted text-[0.8125rem]">{tProducts("card.from")}</span>
      <VatFigure
        figures={figures}
        render={(price) => (
          <>
            <span
              className={cn(
                "text-primary leading-tight font-semibold tabular-nums",
                large ? "text-[1.375rem]" : "text-base",
              )}
            >
              {price.amount}
            </span>
            <span className="text-muted text-sm">
              {item.priceQuantity === null
                ? tProducts("card.perUnitOnly", { unit })
                : item.kind === "stock"
                  ? tProducts("card.perUnitMin", { unit, quantity: item.priceQuantity })
                  : tProducts("card.perUnit", { unit, quantity: item.priceQuantity })}
            </span>
            <span className="text-muted text-xs">{price.vatLabel}</span>
          </>
        )}
      />
    </span>
  );
}

/**
 * The rows view (category Phase 1 item 4, prototype `.prow`), for categories of up to eight items: picture ·
 * name · short description · spec chips · price · MOQ · lead time · one action. Three columns on a wide screen,
 * the price column under the text from 1040 px down, one column on a phone.
 */
export async function ProductRows({
  items,
  details,
  content,
}: {
  items: readonly HubItem[];
  details: ReadonlyMap<string, ProductDetail>;
  content: CategoryContent;
}) {
  const [locale, tProducts] = await Promise.all([getLocale(), getTranslations("products")]);
  const rows = await Promise.all(
    items.map(async (item) => {
      const detail = details.get(item.key);
      const { text, surface } = await shortOf(item, detail, content);
      const chips = await specChips(specsOf(detail ?? null, item.mode === "instant"), surface);
      const words = await itemWords(item);
      return { item, text, chips, words };
    }),
  );
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {rows.map(({ item, text, chips, words }, index) => {
        const name = pick(locale, item.nameTh, item.nameEn);
        const src = storeImageSrc(item.imageUrl, "thumb");
        const alt = item.imageAlt ? pick(locale, item.imageAlt.th, item.imageAlt.en ?? item.imageAlt.th) : name;
        const family = item.kind === "stock" ? "stock" : productFamilyOf(`${item.productTypeCode ?? ""} ${item.key}`);
        return (
          <li
            key={`${item.kind}:${item.key}`}
            className="group border-border bg-surface rounded-card hover:border-border-strong hover:shadow-lift focus-within:ring-focus-ring relative grid grid-cols-1 overflow-hidden border transition-[box-shadow,border-color] focus-within:ring-2 md:grid-cols-[11.25rem_minmax(0,1fr)] lg:grid-cols-[13.75rem_minmax(0,1fr)_15rem]"
          >
            <div
              className={cn(
                "relative grid min-h-[11.25rem] place-items-center md:min-h-[10.625rem]",
                src ? "bg-bg-subtle" : kraftOf(family),
              )}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element -- the catalogue's own image route, as ProductCard
                <img
                  src={src}
                  alt={alt}
                  width={440}
                  height={340}
                  loading={index < 2 ? "eager" : "lazy"}
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <ProductIllustration family={family} className="w-[46%] max-w-36" />
              )}
              {item.mode === "instant" ? (
                <span className="absolute start-3 top-3">
                  <Badge tone="instant" icon="zap">
                    {tProducts("card.instantBadge")}
                  </Badge>
                </span>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col gap-2 px-5 py-4">
              <h3 className="m-0 text-lg leading-snug font-semibold">
                <Link
                  href={itemHref(item)}
                  className="outline-none after:absolute after:inset-0 after:content-[''] hover:underline"
                >
                  {name}
                </Link>
              </h3>
              {text ? <p className="text-muted m-0 text-sm">{text}</p> : null}
              {chips.length ? (
                <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                  {chips.map((chip) => (
                    <li key={chip} className="bg-bg-subtle text-muted rounded-control px-2.5 py-0.5 text-[0.78125rem]">
                      {chip}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="border-border flex flex-col justify-center gap-1.5 border-t px-5 py-4 md:col-span-2 md:flex-row md:flex-wrap md:items-center md:justify-between lg:col-span-1 lg:flex-col lg:items-stretch lg:justify-center lg:border-s lg:border-t-0">
              <div className="flex flex-col gap-1.5">
                <ItemPrice item={item} large />
                {words.moq || words.lead ? (
                  <span className="text-muted flex flex-wrap gap-x-3 gap-y-1 text-[0.78125rem]">
                    {words.moq ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="layers" size={14} aria-hidden="true" />
                        {words.moq}
                      </span>
                    ) : null}
                    {words.lead ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="clock" size={14} aria-hidden="true" />
                        {words.lead}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </div>
              <div className="relative z-[1] mt-2 md:mt-0 lg:mt-2 [&_a]:w-full [&_button]:w-full">
                <ItemAction item={item} name={name} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
