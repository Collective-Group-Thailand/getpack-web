"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { dielineTargetOf } from "@/features/customer/catalog/dieline-target";
import { configureHref } from "@/features/customer/catalog/paths";
import { sizeKey, useOptionPrices } from "@/features/customer/configurator/option-prices";
import { initialState, readyToPrice, type Configurator } from "@/features/customer/configurator/state";
import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { trackCategory } from "@/lib/analytics/category";
import { Button } from "@/ui/components/Button";
import { Input } from "@/ui/components/Input";
import { cn } from "@/ui/lib/cn";

import { bestFit, cmToMm, type FitAnswer, type StandardSize } from "./fit";

export interface FinderProduct {
  slug: string;
  name: string;
  configurator: Configurator;
}

const sizesOf = (configurator: Configurator): StandardSize[] =>
  configurator.standardSizes.filter((size) => size.heightMm > 0);

/** A size's inside box drawn to scale in an isometric view (the selected size's preview). */
function IsoBox({ size, scaleMm, label }: { size: StandardSize; scaleMm: number; label: string }) {
  const k = 100 / scaleMm;
  const [l, w, h] = [size.lengthMm * k, size.widthMm * k, size.heightMm * k];
  const c = Math.cos(Math.PI / 6);
  const p = (x: number, y: number, z: number) => [(x - y) * c, (x + y) * 0.5 - z] as const;
  const pts = (list: (readonly [number, number])[]) =>
    list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const top = [p(0, 0, h), p(l, 0, h), p(l, w, h), p(0, w, h)];
  const left = [p(0, w, 0), p(l, w, 0), p(l, w, h), p(0, w, h)];
  const right = [p(l, 0, 0), p(l, w, 0), p(l, w, h), p(l, 0, h)];
  const all = [...top, ...left, ...right];
  const minX = Math.min(...all.map(([x]) => x));
  const maxX = Math.max(...all.map(([x]) => x));
  const minY = Math.min(...all.map(([, y]) => y));
  const maxY = Math.max(...all.map(([, y]) => y));
  const pad = 6;
  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
      role="img"
      aria-label={label}
      className="h-full w-full"
    >
      <polygon points={pts(left)} className="fill-bg-subtle stroke-border-strong" strokeWidth="0.6" />
      <polygon points={pts(right)} className="fill-border stroke-border-strong" strokeWidth="0.6" />
      <polygon points={pts(top)} className="fill-surface stroke-border-strong" strokeWidth="0.6" />
      <polyline
        points={pts([p(0, w / 2, h), p(l, w / 2, h)])}
        className="stroke-border-strong"
        strokeWidth="0.6"
        strokeDasharray="2 1.5"
        fill="none"
      />
    </svg>
  );
}

/**
 * "หาเบอร์กล่อง" (category Phase 1 item 5, prototype `#sizes`): the customer's product size (cm) → the smallest
 * standard size it fits by the styles' rule (`fit.ts`), with its utilisation and the custom-size tip; every size as a
 * button and on a to-scale front view (length × height, one scale); the selected size with its preview, size and
 * price, "สั่งเบอร์ X" (the configurator on that size) and the free box file when one exists. Prices are the
 * configurator's own batch prices for its opening spec (`useOptionPrices`: one request for every size, the same
 * body the configurator's size step sends) — the web prices nothing. The chosen size is kept in the URL (`size=`).
 */
export function SizeFinder({
  category,
  products,
  initialSize,
}: {
  category: string;
  products: readonly FinderProduct[];
  initialSize: string | null;
}) {
  const t = useTranslations("catalog.categoryPage.finder");
  const tCatalog = useTranslations("catalog");
  const format = useFormat();
  const id = useId();
  const [productSlug, setProductSlug] = useState(
    () =>
      products.find((product) => initialSize && sizesOf(product.configurator).some((s) => s.code === initialSize))
        ?.slug ?? products[0]!.slug,
  );
  const product = products.find((candidate) => candidate.slug === productSlug) ?? products[0]!;
  const { configurator } = product;
  const sizes = useMemo(() => sizesOf(configurator), [configurator]);
  const state = useMemo(() => initialState(configurator), [configurator]);
  const prices = useOptionPrices(configurator, state, readyToPrice(configurator, state));
  const [dims, setDims] = useState({ l: "", w: "", h: "" });
  const [selected, setSelected] = useState<string>(
    () =>
      (initialSize && sizes.find((size) => size.code === initialSize)?.code) ??
      state.standardSizeCode ??
      sizes[0]!.code,
  );
  const current = sizes.find((size) => size.code === selected) ?? sizes[0]!;

  const measured = { l: cmToMm(dims.l), w: cmToMm(dims.w), h: cmToMm(dims.h) };
  const complete = measured.l !== null && measured.w !== null && measured.h !== null;
  const answer: FitAnswer | null = complete ? bestFit(sizes, { l: measured.l!, w: measured.w!, h: measured.h! }) : null;

  const choose = (code: string, report = true) => {
    setSelected(code);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("size", code);
      window.history.replaceState(window.history.state, "", url);
    }
    if (report) trackCategory("category_size_select", { category, product: configurator.slug, size: code });
  };

  // A settled measurement: the recommendation becomes the selection, and the answer is reported once.
  const reported = useRef<string | null>(null);
  const dimsKey = complete ? `${measured.l}x${measured.w}x${measured.h}` : null;
  const answerCode = answer?.size.code ?? null;
  useEffect(() => {
    if (!dimsKey) return;
    const timer = setTimeout(() => {
      if (answerCode) choose(answerCode, false);
      const key = `${configurator.slug}:${dimsKey}`;
      if (reported.current === key) return;
      reported.current = key;
      trackCategory("category_size_find", { category, product: configurator.slug, dims: dimsKey, result: answerCode });
    }, 500);
    return () => clearTimeout(timer);
    // `choose` is stable in effect (it only sets state and the URL).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimsKey, answerCode, configurator.slug, category]);

  const cm = (mm: number) => format.number(mm / 10, { maximumFractionDigits: 2 });
  const dimsOf = (size: StandardSize) => `${cm(size.lengthMm)} × ${cm(size.widthMm)} × ${cm(size.heightMm)}`;
  const priceOf = (code: string) => prices.price(sizeKey(code));
  const vat = tCatalog("price.vatIncluded");
  const unitPrice = (code: string) => {
    const price = priceOf(code);
    return price?.unitPrice ? format.thb(price.unitPrice) : null;
  };
  const dieline = dielineTargetOf(configurator, current.code);
  const maxL = Math.max(...sizes.map((size) => size.lengthMm));
  const maxW = Math.max(...sizes.map((size) => size.widthMm));
  const maxH = Math.max(...sizes.map((size) => size.heightMm));

  // The front view: every size side by side, length × height, in millimetres (one scale).
  const gap = Math.max(16, maxL * 0.1);
  const total = sizes.reduce((sum, size) => sum + size.lengthMm, 0) + gap * (sizes.length - 1);
  const font = Math.max(total / 40, maxH * 0.18);
  const bars = sizes.map((size, index) => ({
    size,
    x: sizes.slice(0, index).reduce((sum, before) => sum + before.lengthMm + gap, 0),
  }));

  const recommendation = (() => {
    if (!complete)
      return (
        <div className="bg-instant-subtle text-instant-subtle-fg rounded-control flex items-center gap-3.5 p-4">
          <span className="w-16 text-center text-2xl font-bold" aria-hidden="true">
            –
          </span>
          <span>
            <b className="block font-semibold">{t("incompleteTitle")}</b>
            <span className="text-[0.8125rem]">{t("incompleteBody")}</span>
          </span>
        </div>
      );
    if (!answer)
      return (
        <div className="bg-instant-subtle text-instant-subtle-fg rounded-control flex flex-wrap items-center gap-3.5 p-4">
          <span className="w-16 text-center text-xl font-bold">{t("noneCode")}</span>
          <span className="min-w-0 flex-1">
            <b className="block font-semibold">{t("noneTitle")}</b>
            <span className="text-[0.8125rem]">{t("noneBody")}</span>
          </span>
          <Button asChild size="sm" variant="secondary">
            <Link href={configureHref(configurator.slug)}>{t("custom")}</Link>
          </Button>
        </div>
      );
    const text = t("recommend", { code: answer.size.code, dims: dimsOf(answer.size) });
    const price = unitPrice(answer.size.code);
    return (
      <div className="bg-primary-subtle text-primary-subtle-fg rounded-control flex items-center gap-3.5 p-4">
        <span className="text-primary min-w-16 text-center text-[1.875rem] leading-none font-bold tabular-nums">
          {answer.size.code}
        </span>
        <span className="min-w-0 flex-1">
          <b className="text-fg block font-semibold tabular-nums">{price ? t("withPrice", { text, price }) : text}</b>
          <span className="text-muted text-[0.8125rem]">
            {t("utilisation", { percent: answer.utilisation })}
            {answer.rotated ? ` · ${t("rotated")}` : ""}
            {answer.lowFit ? ` · ${t("lowFit")}` : ""}
          </span>
          <span className="bg-primary/20 mt-1.5 block h-1.5 overflow-hidden rounded-sm" aria-hidden="true">
            <i className="bg-primary block h-full" style={{ width: `${Math.min(100, answer.utilisation)}%` }} />
          </span>
        </span>
      </div>
    );
  })();

  const currentPrice = unitPrice(current.code);
  const currentStep = priceOf(current.code);

  return (
    <div className="flex flex-col gap-4">
      {products.length > 1 ? (
        <div role="group" aria-label={t("products")} className="flex flex-wrap gap-2">
          {products.map((candidate) => (
            <Button
              key={candidate.slug}
              type="button"
              size="sm"
              variant={candidate.slug === product.slug ? "primary" : "secondary"}
              aria-pressed={candidate.slug === product.slug}
              onClick={() => {
                setProductSlug(candidate.slug);
                const next = sizesOf(candidate.configurator);
                const start = initialState(candidate.configurator).standardSizeCode ?? next[0]?.code;
                if (start) choose(start, false);
              }}
            >
              {candidate.name}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="border-border bg-surface rounded-card flex flex-col gap-4 border p-5 md:p-6">
          <h3 className="m-0 text-[1.0625rem] font-semibold">{t("yours")}</h3>
          <div className="flex items-end gap-2">
            {(["l", "w", "h"] as const).map((axis, index) => (
              <div key={axis} className="flex min-w-0 flex-1 items-end gap-2">
                {index > 0 ? (
                  <span className="text-muted pb-2.5" aria-hidden="true">
                    ×
                  </span>
                ) : null}
                <label
                  className="text-muted flex min-w-0 flex-1 flex-col gap-1 text-[0.78125rem]"
                  htmlFor={`${id}-${axis}`}
                >
                  {t(axis === "l" ? "length" : axis === "w" ? "width" : "height")}
                  <Input
                    id={`${id}-${axis}`}
                    inputMode="decimal"
                    autoComplete="off"
                    value={dims[axis]}
                    onChange={(event) => setDims((previous) => ({ ...previous, [axis]: event.target.value }))}
                    className="text-center text-base font-semibold tabular-nums"
                  />
                </label>
              </div>
            ))}
          </div>
          <p className="text-muted m-0 text-[0.78125rem]">{t("note")}</p>
          <div aria-live="polite">{recommendation}</div>
          <div>
            <span className="text-muted mb-1.5 block text-[0.78125rem]">{t("pick")}</span>
            <div role="group" aria-label={t("pick")} className="flex flex-wrap gap-1.5">
              {sizes.map((size) => (
                <button
                  key={size.code}
                  type="button"
                  aria-pressed={size.code === current.code}
                  aria-label={t("sizeTitle", { code: size.code, dims: dimsOf(size) })}
                  onClick={() => choose(size.code)}
                  className={cn(
                    "rounded-control focus-visible:ring-focus-ring min-h-8 min-w-9 border px-2.5 text-[0.8125rem] font-medium tabular-nums outline-none focus-visible:ring-2",
                    size.code === current.code
                      ? "border-primary bg-primary text-primary-fg"
                      : "border-border-strong bg-surface hover:border-fg",
                  )}
                >
                  {size.code}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-border bg-surface rounded-card flex min-w-0 flex-col gap-3 border p-5 pb-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="m-0 text-[1.0625rem] font-semibold">{t("chartTitle")}</h3>
            <small className="text-muted text-[0.78125rem]">{t("chartScale")}</small>
          </div>
          <div className="relative overflow-x-auto">
            <svg
              viewBox={`-4 -4 ${total + 8} ${maxH + font * 2.9 + 8}`}
              role="img"
              aria-label={t("chartLabel", { product: product.name })}
              className="block h-auto w-full min-w-[40rem]"
            >
              <line x1={-4} x2={total + 4} y1={maxH} y2={maxH} className="stroke-border-strong" strokeWidth={2} />
              {bars.map(({ size, x: at }) => {
                const on = size.code === current.code;
                const price = unitPrice(size.code);
                return (
                  <g key={size.code} onClick={() => choose(size.code)} className="cursor-pointer">
                    <title>{t("sizeTitle", { code: size.code, dims: dimsOf(size) })}</title>
                    <rect
                      x={at}
                      y={maxH - size.heightMm}
                      width={size.lengthMm}
                      height={size.heightMm}
                      rx={4}
                      className={on ? "fill-primary stroke-primary" : "fill-primary/25 stroke-border-strong"}
                      strokeWidth={on ? 3 : 1.5}
                    />
                    <text
                      x={at + size.lengthMm / 2}
                      y={maxH + font * 1.3}
                      textAnchor="middle"
                      fontSize={font}
                      className={cn("tabular-nums", on ? "fill-primary font-bold" : "fill-muted font-semibold")}
                    >
                      {size.code}
                    </text>
                    {price ? (
                      <text
                        x={at + size.lengthMm / 2}
                        y={maxH + font * 2.5}
                        textAnchor="middle"
                        fontSize={font * 0.78}
                        className={cn("tabular-nums", on ? "fill-primary" : "fill-muted")}
                      >
                        {price}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="border-border grid grid-cols-1 items-center gap-4 border-t pt-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] xl:grid-cols-[7.5rem_minmax(0,1fr)_auto]">
            <div className="bg-bg-subtle rounded-control grid h-24 w-full place-items-center p-2 sm:w-30">
              <IsoBox
                size={current}
                scaleMm={Math.max(maxL, maxW, maxH)}
                label={t("preview", { code: current.code })}
              />
            </div>
            <div className="min-w-0">
              <b className="block text-lg font-semibold tabular-nums">
                {currentPrice
                  ? t("withPrice", { text: t("selected", { code: current.code }), price: currentPrice })
                  : t("selected", { code: current.code })}
              </b>
              <span className="text-muted block text-[0.84375rem] tabular-nums">
                {t("dims", { dims: dimsOf(current) })}
              </span>
              {currentPrice ? (
                <span className="text-muted block text-[0.84375rem]">{t("at", { quantity: state.quantity, vat })}</span>
              ) : currentStep && !currentStep.instant ? (
                <span className="text-muted block text-[0.84375rem]">{t("quote")}</span>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2 xl:col-span-1">
              <Button asChild size="sm">
                <Link
                  href={configureHref(configurator.slug, { size: current.code })}
                  onClick={() =>
                    trackCategory("category_size_cta", {
                      category,
                      product: configurator.slug,
                      size: current.code,
                      cta: "order",
                    })
                  }
                >
                  {t("order", { code: current.code })}
                </Link>
              </Button>
              {dieline ? (
                <Button asChild size="sm" variant="secondary" iconStart="download">
                  <Link
                    href={dieline}
                    onClick={() =>
                      trackCategory("category_size_cta", {
                        category,
                        product: configurator.slug,
                        size: current.code,
                        cta: "dieline",
                      })
                    }
                  >
                    {t("dieline")}
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
