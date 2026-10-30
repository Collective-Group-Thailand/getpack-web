"use client";

import { useLocale, useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { productFamilyOf, ProductThumb } from "@/ui/components/ProductIllustration";
import { Icon } from "@/ui/icons";

import { rfqHref } from "../catalog/paths";
import { productNameOf, specLinesOf } from "../orders/summary";
import { AttachedDesign } from "./AttachedDesign";
import type { CartItem } from "./cart";
import { QuantityStepper } from "./QuantityStepper";

/** Every design option the contract names (CONTRACT-GAP store.cart: the line does not say which it may switch to). */
const DESIGN_OPTIONS: readonly Schemas["DesignOption"][] = ["own_file", "online_designer", "hired_design"];

/** "ขนาด 140 × 97.5 × 60 มม." — the API's words; a value that already names itself (print sides) stays alone. */
export function specChips(locale: string, item: CartItem): string[] {
  return specLinesOf(locale, item.summary).map(({ term, description }) =>
    description.startsWith(term) || description.includes(":") ? description : `${term} ${description}`,
  );
}

/**
 * One cart line (checkout redesign item 2): picture, name, the spec as chips, the price lock, quantity, design option,
 * line total and unit price, the tier hint the pricing service gave, and its links. A line whose lock passed is
 * priced again on the customer's word (D-051) and shows the difference until confirmed.
 */
export function CartItemCard({
  item,
  quantityStep,
  pending,
  onQuantity,
  onTierAccept,
  onDesign,
  onSaveForLater,
  onRemove,
  onReprice,
  onConfirmReprice,
}: {
  item: CartItem;
  quantityStep: number | null;
  pending: boolean;
  onQuantity: (quantity: number) => void;
  onTierAccept: (quantity: number) => void;
  onDesign: (option: Schemas["DesignOption"]) => void;
  onSaveForLater: () => void;
  onRemove: () => void;
  onReprice: () => void;
  onConfirmReprice: () => void;
}) {
  const t = useTranslations("cart");
  const tUnits = useTranslations("catalog.stock.units");
  const tDesign = useTranslations("configurator.design.options");
  const locale = useLocale();
  const format = useFormat();
  const name = productNameOf(locale, item.summary);
  const unit = tUnits(item.summary.unit);
  const slug = item.summary.product?.slug ?? null;
  const editHref = item.source === "instant" && slug ? `/configure/${slug}?quote=${item.quoteId}` : null;
  const chips = specChips(locale, item);

  return (
    <article
      aria-labelledby={`cart-item-${item.id}`}
      className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3.5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-5"
    >
      <div className="bg-surface-subtle border-border grid size-18 place-items-center overflow-hidden rounded-xl border sm:size-30">
        {item.summary.product?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- catalogue image from the API
          <img src={item.summary.product.imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <ProductThumb
            family={productFamilyOf(slug ?? item.productTypeCode)}
            className="size-full rounded-none border-0"
          />
        )}
      </div>
      <div className="min-w-0">
        <h3 id={`cart-item-${item.id}`} className="m-0 text-lg leading-snug font-semibold">
          {name}
        </h3>
        {chips.length > 0 ? (
          <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0" aria-label={t("specs")}>
            {chips.map((chip) => (
              <li key={chip} className="bg-bg-subtle text-fg/80 rounded-md px-2.5 py-0.5 text-[12.5px]">
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="m-0 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="bg-primary-subtle text-primary inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-[12.5px] font-semibold">
            <Icon name="lock" size={14} aria-hidden="true" />
            {t("lock", { date: format.date(item.priceLockedUntil) })}
          </span>
          {item.quoteCode ? (
            <span className="text-muted text-xs tabular-nums">{t("lockCode", { code: item.quoteCode })}</span>
          ) : null}
        </p>
        {item.reorderOf ? (
          <p className="text-muted m-0 mt-1.5 text-xs">
            {t(item.reusesApprovedArtwork ? "reorderOfReused" : "reorderOf", { code: item.reorderOf.orderCode })}
          </p>
        ) : null}

        {item.pendingReprice ? (
          <Callout tone="warning" className="mt-3" title={t("repricedTitle")}>
            <div className="flex flex-col items-start gap-2">
              <span>
                {t("repriced", {
                  before: format.thb(item.pendingReprice.previousGrossAmount),
                  after: format.thb(item.pendingReprice.newGrossAmount),
                })}
              </span>
              <Button size="sm" loading={pending} onClick={onConfirmReprice}>
                {t("acceptReprice")}
              </Button>
            </div>
          </Callout>
        ) : !item.priceLocked ? (
          <Callout tone="warning" className="mt-3" title={t("expiredTitle")}>
            <div className="flex flex-col items-start gap-2">
              <span>{t("expired")}</span>
              <Button size="sm" loading={pending} onClick={onReprice}>
                {t("reprice")}
              </Button>
              {/* When today's configuration needs a quote (D-043) or this was an RFQ quotation, ask instead (U-F4). */}
              <Link
                href={`${rfqHref(item.summary.productTypeCode)}${slug ? `?from=${encodeURIComponent(slug)}` : ""}`}
                className="text-primary text-sm underline underline-offset-4"
              >
                {t("orQuote")}
              </Link>
            </div>
          </Callout>
        ) : null}

        <div className="border-border mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-t pt-4">
          {item.quantityEditable && item.priceLocked ? (
            <QuantityStepper
              value={item.quantity}
              step={quantityStep}
              min={item.quantityLimits?.min ?? 1}
              max={item.quantityLimits?.max ?? null}
              unit={unit}
              pending={pending}
              onCommit={onQuantity}
            />
          ) : (
            <p className="m-0 flex flex-col gap-1.5">
              <span className="text-muted text-[12.5px]">{t("quantity")}</span>
              <span className="text-[15px] font-semibold tabular-nums">
                {format.number(item.quantity)} {unit}
              </span>
            </p>
          )}
          {item.source === "instant" ? (
            <Field
              label={t("designOption")}
              className="[&>label]:text-muted min-w-44 [&>label]:text-[12.5px] [&>label]:font-normal"
            >
              <SearchableSelect
                value={item.designOption as Schemas["DesignOption"]}
                disabled={pending}
                onValueChange={onDesign}
                options={DESIGN_OPTIONS.map((option) => ({ value: option, label: tDesign(`${option}.label`) }))}
              />
            </Field>
          ) : (
            <p className="m-0 flex flex-col gap-1.5">
              <span className="text-muted text-[12.5px]">{t("designOption")}</span>
              <span className="text-sm">{tDesign(`${item.designOption}.label`)}</span>
            </p>
          )}
          <p className="m-0 ms-auto text-end leading-tight">
            <span className="sr-only">{t("lineTotal")} </span>
            <b className="text-primary block text-[22px] font-semibold tabular-nums">
              {format.thb(item.productGrossAmount)}
            </b>
            <small className="text-muted text-[12.5px] tabular-nums">
              {t("perUnit", {
                price: format.thb(item.unitPrice),
                quantity: format.number(item.quantity),
                unit,
              })}
            </small>
          </p>
        </div>

        {item.tierHint ? (
          <div className="bg-primary-subtle mt-2.5 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2.5 text-[13px]">
            <Icon name="layers" size={16} aria-hidden="true" className="text-primary shrink-0" />
            <span className="min-w-0 flex-1">
              {t.rich("tierHint", {
                quantity: format.number(item.tierHint.quantity),
                unit,
                price: format.thb(item.tierHint.unitPrice),
                total: format.thb(item.tierHint.productGrossAmount),
                b: (chunks) => <b className="tabular-nums">{chunks}</b>,
              })}
            </span>
            <Button
              size="sm"
              className="shrink-0"
              disabled={pending}
              onClick={() => onTierAccept(item.tierHint!.quantity)}
            >
              {t("tierAccept", { quantity: format.number(item.tierHint.quantity) })}
            </Button>
          </div>
        ) : null}
        {item.designOption !== "own_file" && item.source === "instant" ? (
          <p className="text-muted m-0 mt-2 text-xs">{t("designOptionHint")}</p>
        ) : null}
        {item.designOption === "online_designer" && item.designDocumentId ? (
          <div className="mt-2">
            <AttachedDesign designId={item.designDocumentId} versionNo={item.designVersionNo} />
          </div>
        ) : null}

        <div className="mt-3.5 flex flex-wrap gap-4 text-[13.5px]">
          {editHref ? (
            <Link href={editHref} className="text-primary font-medium no-underline hover:underline">
              {t("editSpec")}
              <span className="sr-only"> {name}</span>
            </Link>
          ) : null}
          <button
            type="button"
            className="text-primary focus-visible:ring-focus-ring rounded-sm font-medium outline-none hover:underline focus-visible:ring-2"
            disabled={pending}
            onClick={onSaveForLater}
          >
            {t("saveForLater")}
            <span className="sr-only"> {name}</span>
          </button>
          <button
            type="button"
            className="text-muted focus-visible:ring-focus-ring rounded-sm font-medium outline-none hover:underline focus-visible:ring-2"
            disabled={pending}
            onClick={onRemove}
          >
            {t("remove")}
            <span className="sr-only"> {name}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
