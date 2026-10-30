"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState } from "react";

import { storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { compareDecimal } from "@/features/customer/catalog/ordering";
import { PRICE_DEBOUNCE_MS, useLivePrice, type PriceStep } from "@/features/customer/configurator/pricing";
import { vatPercentOf } from "@/features/customer/configurator/store-fields";
import { specLabelText } from "@/features/shared/spec-label";
import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { trackProducts } from "@/lib/analytics/products";
import { Button } from "@/ui/components/Button";
import { LINE_PLATE, ProductIllustration, productFamilyOf } from "@/ui/components/ProductIllustration";
import { Skeleton } from "@/ui/components/Skeleton";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import {
  calcBody,
  calcCtaHref,
  defaultPrintChoice,
  printOptions,
  quantityProblem,
  startQuantity,
  type PrintChoice,
} from "./calc";

type Configurator = Schemas["StoreConfiguratorDto"];
type Tiers = Schemas["PriceTiersDto"];

export interface CalcProduct {
  slug: string;
  nameTh: string;
  nameEn: string;
  imageUrl: string | null;
}

/** The configurator of a product (public, cacheable) — the calculator's options and defaults. */
async function readConfigurator(slug: string, signal?: AbortSignal): Promise<Configurator | null> {
  try {
    const { data } = await browserApi().GET("/v1/store/catalog/products/{slug}/configurator", {
      params: { path: { slug } },
      signal,
    });
    return data ?? null;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}

/** The default spec's tier table (C1-API-2); null where the API has none (then `calculate` prices it). */
async function readTiers(slug: string, signal?: AbortSignal): Promise<Tiers | null> {
  try {
    const { data } = await browserApi().GET("/v1/store/catalog/price-hints/{slug}/tiers", {
      params: { path: { slug } },
      signal,
    });
    return data ?? null;
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 405)) return null;
    throw error;
  }
}

const NOTHING = "0.00";

/** "5.0000" → "5", "2.50" → "2.5": the API's percentage as written, without its padding. */
const plainPercent = (value: string | null | undefined) =>
  value && /^\d+(\.\d+)?$/.test(value) ? value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") : null;

/**
 * "คำนวณราคาด่วน" (prompt item 4, prototype `.calc`): an instant product, a quantity (the product's own
 * presets, or any quantity within its minimum and maximum) and the outside print, priced the
 * configurator's way (`./calc.ts`). The default spec at a preset reads the cached tier table; anything
 * else is one debounced `calculate` — the same request the configurator sends. The result panel shows
 * the unit price incl. VAT, ก่อน VAT · VAT · รวม as the API sent them, a tile per preset quantity with its price per
 * piece (and the API's own `savingPercent`), lead time, MOQ, the guarantee and "ปรับขนาดและสั่งซื้อ" into the configurator
 * with the same choices. Nothing is estimated: a quantity without an instant price says so.
 */
export function QuickCalc({ products, guaranteeHref }: { products: CalcProduct[]; guaranteeHref: string }) {
  const t = useTranslations("products.calc");
  const tCatalog = useTranslations("catalog");
  const tConfigurator = useTranslations("configurator.choices");
  const tQuantity = useTranslations("configurator.quantity");
  const locale = useLocale();
  const format = useFormat();
  const id = useId();
  const [slug, setSlug] = useState(products[0]?.slug ?? "");
  const [quantity, setQuantity] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [print, setPrint] = useState<PrintChoice | null>(null);

  const configuratorQuery = useQuery({
    queryKey: [...queryKeys.detail("customer", "configurator", slug)],
    queryFn: ({ signal }) => readConfigurator(slug, signal),
    enabled: slug !== "",
    staleTime: 300_000,
  });
  const tiersQuery = useQuery({
    queryKey: [...queryKeys.related("customer", "price-hints", slug, "tiers")],
    queryFn: ({ signal }) => readTiers(slug, signal),
    enabled: slug !== "",
    staleTime: 60_000,
    retry: false,
  });
  const configurator = configuratorQuery.data ?? null;
  const qty = configurator ? (quantity ?? startQuantity(configurator)) : null;
  const options = useMemo(() => (configurator ? printOptions(configurator) : []), [configurator]);
  const defaultChoice = configurator ? defaultPrintChoice(configurator) : null;
  const chosenPrint = print ?? defaultChoice;
  const input = qty !== null ? { quantity: qty, print: chosenPrint } : null;
  const problem = configurator && qty !== null ? quantityProblem(configurator, qty) : null;

  // The default spec at a quantity the tier table holds: read from it; anything else asks `calculate`.
  const fromTiers =
    tiersQuery.data && chosenPrint === defaultChoice && qty !== null
      ? tiersQuery.data.tiers.find((step) => step.quantity === qty)
        ? tiersQuery.data.tiers
        : null
      : null;
  const body =
    configurator && input && !problem && !fromTiers && !tiersQuery.isLoading ? calcBody(configurator, input) : null;
  const live = useLivePrice(body, Math.min(PRICE_DEBOUNCE_MS, 250));
  const steps: PriceStep[] | null = fromTiers ?? live.data?.steps ?? null;
  const step = steps?.find((candidate) => candidate.quantity === qty) ?? null;
  const priced = step && step.instant && step.unitPrice !== null ? step : null;
  const pending = !fromTiers && (live.pending || configuratorQuery.isLoading || tiersQuery.isLoading);

  useEffect(() => {
    if (!slug || qty === null) return;
    trackProducts("products_calc_change", { product: slug, qty, print: chosenPrint ?? "default" });
  }, [slug, qty, chosenPrint]);

  const product = products.find((candidate) => candidate.slug === slug);
  const unit = tCatalog(`stock.units.${configurator?.unit ?? "piece"}`);
  const spec = specLabelText(
    configurator?.defaultSpec?.specLabel ?? tiersQuery.data?.basis?.label ?? null,
    format.locale,
  );
  const vatRate = vatPercentOf(priced?.vatRate);
  const ctaHref = configurator && input && !problem ? calcCtaHref(configurator, input) : null;
  const tooling =
    priced?.toolingAmount && compareDecimal(priced.toolingAmount, NOTHING) > 0 ? priced.toolingAmount : null;
  const leadDays = priced?.leadTimeDays ?? null;
  const shortage = plainPercent(priced?.toleranceShortagePct);
  const overage = plainPercent(priced?.toleranceOveragePct);

  const inkName = (inkId: string | null) => {
    const option = configurator?.optionGroups
      .flatMap((group) => group.options)
      .find((candidate) => candidate.id === inkId);
    return option ? pick(locale, option.nameTh, option.nameEn) : null;
  };
  const printLabel = (choice: PrintChoice, inkId: string | null) =>
    choice === "none"
      ? t("printNone")
      : choice === "spot"
        ? t("printSpots")
        : (inkName(inkId) ?? tConfigurator("print.none"));

  // The quantities offered as tiles: the product's presets within its limits, each with its price per piece from
  // the same steps the result reads (the tier table, or the live calculation) — never computed here.
  const presets = configurator
    ? [...new Set(configurator.quantity.presets)]
        .sort((x, y) => x - y)
        .filter((preset) => quantityProblem(configurator, preset) === null)
    : [];
  const stepAt = (quantity: number) => steps?.find((candidate) => candidate.quantity === quantity) ?? null;
  const customOn = custom !== "";
  const legend = "mb-2.5 text-[0.8125rem] font-semibold";

  return (
    // Two cards side by side from 65rem (stacked below): the options, and the result at its own height, sticky
    // under the header while the options scroll — never one card split into halves with an empty tinted half.
    <div className="grid grid-cols-1 items-start gap-4 min-[65rem]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] min-[65rem]:gap-6">
      <div className="border-border bg-surface rounded-panel flex min-w-0 flex-col gap-6 border p-5 md:p-7">
        {/* 1. The product: compact picture chips — one scrolling row on a phone, wrapping from `sm`. */}
        <fieldset className="min-w-0">
          <legend className={legend}>{t("product")}</legend>
          <div className="-mx-5 flex [scrollbar-width:none] gap-2 overflow-x-auto overscroll-x-contain px-5 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
            {products.map((candidate) => {
              const pressed = candidate.slug === slug;
              const src = storeImageSrc(candidate.imageUrl, "thumb");
              return (
                <button
                  key={candidate.slug}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => {
                    setSlug(candidate.slug);
                    setQuantity(null);
                    setCustom("");
                    setPrint(null);
                  }}
                  className={cn(
                    "focus-visible:ring-focus-ring rounded-control flex min-h-12 w-[13.5rem] shrink-0 items-center gap-2.5 border py-1.5 ps-1.5 pe-3 text-start text-[0.8125rem] leading-snug font-medium outline-none focus-visible:ring-2 sm:w-auto",
                    pressed
                      ? "border-primary bg-primary-subtle text-primary-subtle-fg ring-primary ring-1"
                      : "border-border-strong bg-surface hover:border-fg",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center overflow-hidden rounded-md",
                      src ? "bg-surface-subtle" : LINE_PLATE,
                    )}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element -- catalogue images come through the BFF (ProductCard)
                      <img src={src} alt="" width={32} height={32} loading="lazy" className="size-full object-cover" />
                    ) : (
                      <ProductIllustration family={productFamilyOf(candidate.slug)} className="max-w-6" />
                    )}
                  </span>
                  <span className="min-w-0 [overflow-wrap:break-word] break-keep">
                    <NameParts name={pick(locale, candidate.nameTh, candidate.nameEn)} />
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 2. The quantity, chosen in one place: a tile per tier with its price per piece (the API's saving under
            it when the API sent one), then a tile for any other quantity. */}
        <fieldset className="min-w-0">
          <legend className={legend}>{t("quantity", { unit })}</legend>
          {configurator ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {presets.map((preset) => {
                  const tier = stepAt(preset);
                  const pressed = qty === preset && !customOn;
                  const saving = tier?.instant && tier.unitPrice ? (tier.savingPercent ?? null) : null;
                  return (
                    <button
                      key={preset}
                      type="button"
                      aria-pressed={pressed}
                      onClick={() => {
                        setQuantity(preset);
                        setCustom("");
                      }}
                      className={cn(
                        "focus-visible:ring-focus-ring rounded-control flex min-h-16 flex-col items-start justify-center gap-0.5 border px-3 py-2 text-start outline-none focus-visible:ring-2",
                        pressed
                          ? "border-primary bg-primary-subtle ring-primary ring-1 ring-inset"
                          : "border-border-strong bg-surface hover:border-fg",
                      )}
                    >
                      <span className="text-sm font-semibold tabular-nums">
                        {format.number(preset)} <span className="text-muted text-xs font-normal">{unit}</span>
                      </span>
                      <span
                        className={cn(
                          "text-[0.8125rem] tabular-nums",
                          pressed ? "text-primary font-semibold" : "text-muted",
                          pending && "opacity-60",
                        )}
                      >
                        {tier?.instant && tier.unitPrice ? (
                          `${format.thb(tier.unitPrice)}${t("perUnit", { unit })}`
                        ) : tier ? (
                          t("quoteCta")
                        ) : steps ? null : (
                          <span className="bg-bg-subtle inline-block h-3 w-14 animate-pulse rounded-sm align-middle" />
                        )}
                      </span>
                      {saving ? (
                        <span className="text-primary text-[0.71875rem] leading-tight font-semibold">
                          {tQuantity("saving", { percent: format.number(saving) })}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                {/* Any other quantity: a tile like the others — its label, an inline field with the unit after it,
                    and the minimum under it when the product has one. */}
                <label
                  htmlFor={`${id}-qty`}
                  className={cn(
                    "rounded-control focus-within:ring-focus-ring flex min-h-16 cursor-text flex-col justify-center gap-0.5 border px-3 py-2 focus-within:ring-2",
                    customOn
                      ? "border-primary bg-primary-subtle ring-primary ring-1 ring-inset"
                      : "border-border-strong bg-surface hover:border-fg",
                  )}
                >
                  <span className="text-muted text-xs leading-tight">{t("customQuantity")}</span>
                  <span className="flex items-baseline gap-1.5">
                    <input
                      id={`${id}-qty`}
                      type="number"
                      inputMode="numeric"
                      min={configurator.quantity.min ?? 1}
                      max={configurator.quantity.max ?? undefined}
                      step={1}
                      value={custom}
                      aria-invalid={customOn && problem !== null}
                      aria-describedby={problem ? `${id}-qty-problem` : undefined}
                      onChange={(event) => {
                        setCustom(event.target.value);
                        const next = Number(event.target.value);
                        if (event.target.value !== "" && Number.isInteger(next) && next > 0) setQuantity(next);
                        else if (event.target.value === "") setQuantity(null);
                      }}
                      className="border-border-strong placeholder:text-muted w-full min-w-0 [appearance:textfield] border-0 border-b bg-transparent p-0 pb-0.5 text-sm font-semibold tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="text-muted shrink-0 text-xs">{unit}</span>
                  </span>
                  {configurator.quantity.min ? (
                    <span className="text-muted text-[0.71875rem] leading-tight">
                      {t("moq", { quantity: configurator.quantity.min, unit })}
                    </span>
                  ) : null}
                </label>
              </div>
              {problem && customOn ? (
                <p id={`${id}-qty-problem`} className="text-danger-subtle-fg mt-2 text-[0.8125rem]">
                  {problem === "max"
                    ? t("aboveMaximum", { max: configurator.quantity.max ?? 0, unit })
                    : t("belowMinimum", { min: configurator.quantity.min ?? 1, unit })}
                </p>
              ) : null}
            </>
          ) : (
            <Skeleton className="h-16 w-full" />
          )}
        </fieldset>

        {/* 3. The options: the outside print. */}
        {options.length > 0 ? (
          <fieldset className="min-w-0">
            <legend className={legend}>{t("print")}</legend>
            <div className="flex flex-wrap gap-1.5">
              {options.map((option) => {
                const pressed = option.choice === chosenPrint;
                return (
                  <button
                    key={option.choice}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => setPrint(option.choice)}
                    className={cn(
                      "focus-visible:ring-focus-ring rounded-control min-h-9.5 border px-3.5 text-[0.84375rem] font-medium outline-none focus-visible:ring-2",
                      pressed
                        ? "bg-primary border-primary text-primary-fg"
                        : "border-border-strong bg-surface text-muted hover:text-fg",
                    )}
                  >
                    {printLabel(option.choice, option.inkId)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        <p className="text-muted m-0 text-[0.8125rem]">{spec ? t("reference", { spec }) : t("referenceGeneric")}</p>
      </div>

      {/* 4. The result on the pale brand tint (never a dark panel): the price per piece, the total and its VAT, the
          facts, the one primary action, the note. Below the options on a phone, its button full width. */}
      <div
        className="bg-primary-subtle text-fg border-border rounded-panel flex min-w-0 flex-col gap-5 border p-5 md:p-7 min-[65rem]:sticky min-[65rem]:top-[calc(var(--site-sticky-top)+1.25rem)]"
        aria-live="polite"
        aria-busy={pending}
      >
        {configuratorQuery.isError || live.isError ? (
          <div className="flex flex-col items-start gap-3">
            <p>{t("failed")}</p>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                void configuratorQuery.refetch();
                void live.refetch();
              }}
            >
              {t("retry")}
            </Button>
          </div>
        ) : priced && qty !== null ? (
          <>
            <div>
              <span className="text-muted text-[0.8125rem]">
                {t("summary", { quantity: qty, unit, vat: tCatalog("price.vatIncluded") })}
              </span>
              <p className={cn("m-0 mt-1 flex items-baseline gap-1.5 tabular-nums", pending && "opacity-60")}>
                <span className="text-primary text-[2.5rem] leading-none font-semibold tracking-tight md:text-[3rem]">
                  {format.thb(priced.unitPrice)}
                </span>
                <small className="text-muted text-base">{t("perUnit", { unit })}</small>
              </p>
            </div>
            <dl className="border-border m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-t pt-4 text-sm tabular-nums">
              {priced.netAmount ? (
                <>
                  <dt className="text-muted">{t("netAmount")}</dt>
                  <dd className="m-0 text-end font-medium">{format.thb(priced.netAmount)}</dd>
                </>
              ) : null}
              <dt className="text-muted">{vatRate ? t("vatAmount", { rate: `${vatRate}%` }) : t("vatAmountNoRate")}</dt>
              <dd className="m-0 text-end font-medium">{format.thb(priced.vatAmount)}</dd>
              <dt className="font-semibold">{t("grossAmount")}</dt>
              <dd className="m-0 text-end text-lg font-semibold">{format.thb(priced.grossAmount)}</dd>
              {tooling ? (
                <>
                  <dt className="text-muted text-[0.8125rem]">{t("tooling")}</dt>
                  <dd className="m-0 text-end text-[0.8125rem]">{format.thb(tooling)}</dd>
                </>
              ) : null}
            </dl>
            <ul className="text-muted m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-[0.8125rem]">
              {leadDays !== null ? (
                <li className="inline-flex items-center gap-1.5">
                  <Icon name="clock" size={16} aria-hidden="true" className="text-primary" />
                  {t("leadTime", { days: leadDays })}
                </li>
              ) : null}
              {configurator?.quantity.min ? (
                <li className="inline-flex items-center gap-1.5">
                  <Icon name="layers" size={16} aria-hidden="true" className="text-primary" />
                  {t("moq", { quantity: configurator.quantity.min, unit })}
                </li>
              ) : null}
              <li>
                <Link
                  href={guaranteeHref}
                  className="text-primary focus-visible:ring-focus-ring inline-flex items-center gap-1.5 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2"
                >
                  <Icon name="shield" size={16} aria-hidden="true" />
                  {t("warranty")}
                </Link>
              </li>
            </ul>
            {ctaHref ? (
              <Button
                asChild
                size="lg"
                block
                iconEnd="arrow-right"
                onClick={() =>
                  trackProducts("products_calc_cta", { product: slug, qty, print: chosenPrint ?? "default" })
                }
              >
                <Link href={ctaHref}>{t("cta")}</Link>
              </Button>
            ) : null}
            <p className="text-muted m-0 text-xs leading-relaxed">
              {t("shippingNote")} ·{" "}
              {shortage && overage ? t("toleranceRange", { shortage, overage }) : t("toleranceNote")}{" "}
              <Link href={guaranteeHref} className="text-primary underline underline-offset-2">
                {t("toleranceLink")}
              </Link>
            </p>
          </>
        ) : step && !priced && !pending ? (
          <div className="flex flex-col items-start gap-3">
            <p>{t("noPrice")}</p>
            {ctaHref ? (
              <Button asChild size="lg" block>
                <Link href={ctaHref}>{t("quoteCta")}</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3" aria-label={t("pending")}>
            <Skeleton className="bg-surface h-4 w-48" />
            <Skeleton className="bg-surface h-12 w-40" />
            <Skeleton className="bg-surface h-24 w-full" />
            <Skeleton className="bg-surface h-13 w-full" />
            <span className="sr-only">{product ? pick(locale, product.nameTh, product.nameEn) : null}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** A product's name with any "(…)" kept whole, so a line never breaks inside the parenthesis. */
function NameParts({ name }: { name: string }) {
  return (
    <>
      {name.split(/(\([^)]*\))/).map((part, index) =>
        part.startsWith("(") ? (
          <span key={index} className="whitespace-nowrap">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
