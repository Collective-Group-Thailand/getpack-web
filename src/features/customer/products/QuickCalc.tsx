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
 * the unit price incl. VAT, ก่อน VAT · VAT · รวม as the API sent them, a bar per preset (heights from the
 * API's own `savingPercent`), lead time, MOQ, the guarantee and "ปรับขนาดและสั่งซื้อ" into the configurator
 * with the same choices. Nothing is estimated: a quantity without an instant price says so.
 */
export function QuickCalc({ products, guaranteeHref }: { products: CalcProduct[]; guaranteeHref: string }) {
  const t = useTranslations("products.calc");
  const tCatalog = useTranslations("catalog");
  const tConfigurator = useTranslations("configurator.choices");
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

  const chip = (pressed: boolean) =>
    cn(
      "focus-visible:ring-focus-ring rounded-control inline-flex min-h-9.5 items-center border px-3.5 text-[0.84375rem] font-medium tabular-nums outline-none focus-visible:ring-2",
      pressed ? "bg-fg text-bg border-fg" : "border-border-strong bg-surface hover:border-fg",
    );

  return (
    <div className="border-border bg-surface rounded-panel grid grid-cols-1 overflow-hidden border min-[65rem]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5 p-5 md:p-7">
        <fieldset>
          <legend className="mb-2 text-[0.8125rem] font-semibold">{t("product")}</legend>
          <div className="grid grid-cols-1 gap-2 min-[26rem]:grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))]">
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
                    "focus-visible:ring-focus-ring flex min-h-14.5 items-center gap-2.5 rounded-xl border p-2 text-start text-[0.8125rem] leading-snug outline-none focus-visible:ring-2",
                    pressed
                      ? "border-primary bg-primary-subtle ring-primary ring-1"
                      : "border-border-strong bg-surface hover:border-fg",
                  )}
                >
                  <span className="bg-bg-subtle grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element -- catalogue images come through the BFF (ProductCard)
                      <img src={src} alt="" width={40} height={40} loading="lazy" className="size-full object-cover" />
                    ) : (
                      <Icon name="box" size={20} className="text-muted" aria-hidden="true" />
                    )}
                  </span>
                  <span className="line-clamp-3">{pick(locale, candidate.nameTh, candidate.nameEn)}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[0.8125rem] font-semibold">{t("quantity", { unit })}</legend>
          {configurator ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {[...new Set(configurator.quantity.presets)]
                .sort((a, b) => a - b)
                .filter((preset) => quantityProblem(configurator, preset) === null)
                .map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={qty === preset && custom === ""}
                    onClick={() => {
                      setQuantity(preset);
                      setCustom("");
                    }}
                    className={chip(qty === preset && custom === "")}
                  >
                    {format.number(preset)}
                  </button>
                ))}
              <label className="sr-only" htmlFor={`${id}-qty`}>
                {t("customQuantity")}
              </label>
              <input
                id={`${id}-qty`}
                type="number"
                inputMode="numeric"
                min={configurator.quantity.min ?? 1}
                max={configurator.quantity.max ?? undefined}
                step={1}
                placeholder={t("customQuantity")}
                value={custom}
                aria-invalid={custom !== "" && problem !== null}
                aria-describedby={problem ? `${id}-qty-problem` : undefined}
                onChange={(event) => {
                  setCustom(event.target.value);
                  const next = Number(event.target.value);
                  if (event.target.value !== "" && Number.isInteger(next) && next > 0) setQuantity(next);
                  else if (event.target.value === "") setQuantity(null);
                }}
                className="border-border-strong bg-surface rounded-control focus-visible:border-primary focus-visible:ring-focus-ring h-9.5 w-32 border px-2.5 text-[0.84375rem] font-semibold tabular-nums outline-none focus-visible:ring-2"
              />
              {problem && custom !== "" ? (
                <p id={`${id}-qty-problem`} className="text-danger-subtle-fg basis-full text-[0.8125rem]">
                  {problem === "max"
                    ? t("aboveMaximum", { max: configurator.quantity.max ?? 0, unit })
                    : t("belowMinimum", { min: configurator.quantity.min ?? 1, unit })}
                </p>
              ) : null}
            </div>
          ) : (
            <Skeleton className="h-9.5 w-full max-w-md" />
          )}
        </fieldset>

        {options.length > 0 ? (
          <fieldset>
            <legend className="mb-2 text-[0.8125rem] font-semibold">{t("print")}</legend>
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
                      "focus-visible:ring-focus-ring rounded-control min-h-8 border px-3.5 text-[0.84375rem] outline-none focus-visible:ring-2",
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

      <div className="bg-fg text-bg flex flex-col gap-4 p-5 md:p-7" aria-live="polite" aria-busy={pending}>
        {configuratorQuery.isError || live.isError ? (
          <div className="flex flex-col items-start gap-3">
            <p>{t("failed")}</p>
            <Button
              type="button"
              size="sm"
              className="bg-bg text-fg hover:bg-bg/90"
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
            <span className="text-[0.78125rem] opacity-75">
              {t("summary", { quantity: qty, unit, vat: tCatalog("price.vatIncluded") })}
            </span>
            <p className={cn("m-0 flex items-baseline gap-1.5 tabular-nums", pending && "opacity-60")}>
              <span className="text-[2.5rem] leading-none font-semibold tracking-tight md:text-[3.25rem]">
                {format.thb(priced.unitPrice)}
              </span>
              <small className="text-base opacity-70">{t("perUnit", { unit })}</small>
            </p>
            {steps && steps.length > 1 ? (
              <ol aria-label={t("barsLabel")} className="m-0 flex h-11 list-none items-end gap-1 p-0">
                {steps.map((bar) => {
                  const instant = bar.instant && bar.unitPrice !== null;
                  // The bar's height is the API's own saving against the smallest quantity (C4-API-2), not maths on prices.
                  const height = instant ? Math.max(12, 100 - (bar.savingPercent ?? 0)) : 12;
                  return (
                    <li
                      key={bar.quantity}
                      className={cn(
                        "flex-1 rounded-t-sm",
                        bar.quantity === qty ? "bg-primary" : instant ? "bg-bg/25" : "bg-bg/10",
                      )}
                      style={{ height: `${height}%` }}
                    >
                      <span className="sr-only">
                        {instant
                          ? t("barLabel", { quantity: bar.quantity, unit, price: format.thb(bar.unitPrice) })
                          : t("barNoPrice", { quantity: bar.quantity, unit })}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : null}
            <dl className="border-bg/20 m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-t pt-4 text-sm tabular-nums">
              {priced.netAmount ? (
                <>
                  <dt className="opacity-75">{t("netAmount")}</dt>
                  <dd className="m-0 text-end font-medium">{format.thb(priced.netAmount)}</dd>
                </>
              ) : null}
              <dt className="opacity-75">{vatRate ? t("vatAmount", { rate: `${vatRate}%` }) : t("vatAmountNoRate")}</dt>
              <dd className="m-0 text-end font-medium">{format.thb(priced.vatAmount)}</dd>
              <dt className="opacity-75">{t("grossAmount")}</dt>
              <dd className="m-0 text-end text-lg font-semibold">{format.thb(priced.grossAmount)}</dd>
              {tooling ? (
                <>
                  <dt className="text-[0.8125rem] opacity-75">{t("tooling")}</dt>
                  <dd className="m-0 text-end text-[0.8125rem] opacity-90">{format.thb(tooling)}</dd>
                </>
              ) : null}
            </dl>
            <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-[0.8125rem] opacity-85">
              {leadDays !== null ? (
                <li className="inline-flex items-center gap-1.5">
                  <Icon name="clock" size={16} aria-hidden="true" />
                  {t("leadTime", { days: leadDays })}
                </li>
              ) : null}
              {configurator?.quantity.min ? (
                <li className="inline-flex items-center gap-1.5">
                  <Icon name="layers" size={16} aria-hidden="true" />
                  {t("moq", { quantity: configurator.quantity.min, unit })}
                </li>
              ) : null}
              <li>
                <Link
                  href={guaranteeHref}
                  className="focus-visible:ring-focus-ring inline-flex items-center gap-1.5 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2"
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
                className="bg-bg text-fg hover:bg-bg/90 mt-auto"
                onClick={() =>
                  trackProducts("products_calc_cta", { product: slug, qty, print: chosenPrint ?? "default" })
                }
              >
                <Link href={ctaHref}>{t("cta")}</Link>
              </Button>
            ) : null}
            <p className="m-0 text-xs opacity-65">
              {t("shippingNote")} ·{" "}
              {shortage && overage ? t("toleranceRange", { shortage, overage }) : t("toleranceNote")}{" "}
              <Link href={guaranteeHref} className="underline underline-offset-2">
                {t("toleranceLink")}
              </Link>
            </p>
          </>
        ) : step && !priced && !pending ? (
          <div className="flex flex-col items-start gap-3">
            <p>{t("noPrice")}</p>
            {ctaHref ? (
              <Button asChild size="sm" className="bg-bg text-fg hover:bg-bg/90">
                <Link href={ctaHref}>{t("quoteCta")}</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3" aria-label={t("pending")}>
            <Skeleton className="bg-bg/15 h-4 w-48" />
            <Skeleton className="bg-bg/15 h-12 w-40" />
            <Skeleton className="bg-bg/15 h-11 w-full" />
            <Skeleton className="bg-bg/15 h-24 w-full" />
            <span className="sr-only">{product ? pick(locale, product.nameTh, product.nameEn) : null}</span>
          </div>
        )}
      </div>
    </div>
  );
}
