import { getLocale, getTranslations } from "next-intl/server";

import { storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { Link } from "@/i18n/navigation";
import { STOCK_AVAILABILITY } from "@/domain/status";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { Icon } from "@/ui/icons";

import { outOfStock, type HubItem } from "./hub";
import { itemHref, itemWords, trayItemOf, VatFigure } from "./HubCard";
import { RfqToggle } from "./RfqToggle";
import { StockCartButton } from "./StockCartButton";

/**
 * The price table (prompt item 7, prototype `.ptable`): one row per item — สินค้า (thumbnail and name),
 * หมวด, วิธีซื้อ, ราคาเริ่มต้น (the header says it is incl. VAT), ที่จำนวน, ขั้นต่ำ, ระยะผลิต and the
 * same action as the card. On a narrow screen the table scrolls inside its own frame, never the page.
 * Rendered only when the table view is chosen.
 */
export async function PriceTable({
  items,
  categoryNames,
  vatLabel,
  labels,
}: {
  items: readonly HubItem[];
  categoryNames: ReadonlyMap<string, string>;
  /** The header's basis words; the column follows the page's VAT switch (D-447 §10.6). */
  vatLabel: { incl: string; excl: string };
  labels: Record<HubItem["mode"], string>;
}) {
  const [locale, tStatus] = await Promise.all([getLocale(), getTranslations("status")]);
  const rows = await Promise.all(
    items.map(async (item) => {
      const { t, format, unit, figures, fallbackText, cartLabel } = await itemWords(item);
      const moq = item.moq !== null ? `${format.number(item.moq)} ${unit}` : null;
      const lead = item.leadTime
        ? item.leadTime.min === item.leadTime.max
          ? t("table.leadExact", { days: item.leadTime.min })
          : t("table.leadRange", { min: item.leadTime.min, max: item.leadTime.max })
        : null;
      const name = pick(locale, item.nameTh, item.nameEn);
      const src = storeImageSrc(item.imageUrl, "thumb");
      return { item, t, format, figures, fallbackText, moq, lead, name, src, cartLabel };
    }),
  );
  const t = rows[0]?.t;
  if (!t) return null;
  const anyExVat = rows.some((row) => row.figures.excl !== null);
  const head = "text-muted bg-bg-subtle px-4 py-3 text-start text-[0.8125rem] font-medium whitespace-nowrap";
  return (
    <div
      className="border-border bg-surface rounded-card relative overflow-x-auto border"
      tabIndex={0}
      role="region"
      aria-label={t("table.caption")}
    >
      <table className="w-full min-w-[52rem] border-collapse text-sm">
        <caption className="sr-only">{t("table.caption")}</caption>
        <thead>
          <tr className="border-border border-b">
            <th scope="col" className={head}>
              {t("table.product")}
            </th>
            <th scope="col" className={head}>
              {t("table.category")}
            </th>
            <th scope="col" className={head}>
              {t("table.mode")}
            </th>
            <th scope="col" className={head}>
              {anyExVat ? (
                <>
                  <span data-vat-figure="incl" className="contents">
                    {t("table.price", { vat: vatLabel.incl })}
                  </span>
                  <span data-vat-figure="excl" className="contents">
                    {t("table.price", { vat: vatLabel.excl })}
                  </span>
                </>
              ) : (
                t("table.price", { vat: vatLabel.incl })
              )}
            </th>
            <th scope="col" className={head}>
              {t("table.atQuantity")}
            </th>
            <th scope="col" className={head}>
              {t("table.moq")}
            </th>
            <th scope="col" className={head}>
              {t("table.lead")}
            </th>
            <th scope="col" className={head}>
              <span className="sr-only">{t("table.action")}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map(({ item, format, figures, fallbackText, moq, lead, name, src, cartLabel }) => (
            <tr key={`${item.kind}:${item.key}`}>
              <th scope="row" className="px-4 py-3 text-start font-medium">
                <Link
                  href={itemHref(item)}
                  className="hover:text-primary focus-visible:ring-focus-ring flex items-center gap-3 rounded-md outline-none focus-visible:ring-2"
                >
                  <span className="bg-bg-subtle grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element -- catalogue images come through the BFF (ProductCard)
                      <img src={src} alt="" width={40} height={40} loading="lazy" className="size-full object-cover" />
                    ) : (
                      <Icon name={item.kind === "stock" ? "package" : "box"} size={20} className="text-muted" />
                    )}
                  </span>
                  <span className="line-clamp-2 min-w-40">{name}</span>
                </Link>
              </th>
              <td className="text-muted px-4 py-3">
                {item.categoryCode ? (categoryNames.get(item.categoryCode) ?? "") : ""}
              </td>
              <td className="px-4 py-3">
                <Badge
                  size="sm"
                  tone={item.mode === "instant" ? "instant" : item.mode === "stock" ? "primary" : "neutral"}
                  className="whitespace-nowrap"
                >
                  {labels[item.mode]}
                </Badge>
                {outOfStock(item) ? (
                  // D-447 §10.4: no cart for an out-of-stock item; the quote tray stays.
                  <StatusBadge
                    size="sm"
                    className="ms-1.5 whitespace-nowrap"
                    meta={STOCK_AVAILABILITY.out_of_stock}
                    label={tStatus(STOCK_AVAILABILITY.out_of_stock.labelKey)}
                  />
                ) : null}
              </td>
              <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                {figures.incl ? (
                  <VatFigure
                    figures={figures}
                    render={(price) => <b className="text-primary text-[0.9375rem] font-semibold">{price.amount}</b>}
                  />
                ) : (
                  <span className="text-muted">{fallbackText}</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                {figures.incl && item.priceQuantity !== null ? format.number(item.priceQuantity) : t("table.none")}
              </td>
              <td className="px-4 py-3 whitespace-nowrap tabular-nums">{moq ?? t("table.none")}</td>
              <td className="px-4 py-3 whitespace-nowrap">{lead ?? t("table.none")}</td>
              <td className="px-4 py-3 text-end">
                {item.mode === "instant" ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link href={itemHref(item)}>{t("card.buy")}</Link>
                  </Button>
                ) : cartLabel && item.id && item.priceQuantity !== null ? (
                  // D-447 §10.2: the cart and the quote tray both for a stock item on hand with a price.
                  <span className="inline-flex flex-wrap justify-end gap-2">
                    <StockCartButton
                      stockProductId={item.id}
                      quantity={item.priceQuantity}
                      name={name}
                      label={cartLabel}
                    />
                    <RfqToggle item={trayItemOf(item)} name={name} size="sm" />
                  </span>
                ) : (
                  <RfqToggle item={trayItemOf(item)} name={name} size="sm" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
