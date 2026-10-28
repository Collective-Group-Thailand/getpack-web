"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { StyleDetail } from "@/features/customer/catalog/api.server";
import { configureHref } from "@/features/customer/catalog/paths";
import { displayPrice, figuresOf } from "@/features/shared/format/price";
import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Sheet } from "@/ui/components/Sheet";
import { Spinner } from "@/ui/components/Spinner";
import { Icon } from "@/ui/icons";

import { trackCatalog } from "@/lib/analytics/catalog";
import { facetLabel, type StylesT } from "./labels";
import { DIELINE_FRAGMENT, styleHref } from "./paths";
import { cmOf, cmOfSize } from "./size";
import { VariantPicker } from "./VariantPicker";

export interface QuickViewProps {
  code: string;
  onClose: () => void;
  /** The quotation form of each category's product type (`/rfq/<category>`), from the server. */
  quoteHrefs: Record<string, string | null>;
  signedIn: boolean;
  /** Staff's note on tax invoices (`store.style-library.settings`); none, no row. */
  taxInvoiceNote: string | null;
  /** The size search the list is under (`LxWxH` mm, C0): the panel then says whether and how it fits. */
  size?: string;
}

type Fit = NonNullable<StyleDetail["fit"]>;

type State = { key: string } & ({ status: "loading" } | { status: "error" } | { status: "ready"; style: StyleDetail });

/**
 * A style without leaving the library (styles redesign §8): a side panel — a full-height sheet on
 * a phone — with its picture, drawing and 3D, the option picker, the facts the API has, and the
 * ways on: design it in the studio, buy it (instant) or ask for a quote, the free dieline. Its URL
 * (`?style=PK-…`) is shareable and survives a refresh. Loaded on first opening.
 *
 * Every fact is shown only when the API has it; prices are the API's, incl. VAT (D-220).
 */
export default function QuickView({ code, onClose, quoteHrefs, signedIn, taxInvoiceNote, size }: QuickViewProps) {
  const t = useTranslations("styles");
  const words = t as unknown as StylesT;
  const locale = useLocale();
  const format = useFormat();
  const [attempt, setAttempt] = useState(0);
  const key = `${code}:${attempt}`;
  const [loaded, setLoaded] = useState<State>({ key: "", status: "loading" });
  // What was loaded for another style (or an earlier try) is not this one's: loading until it arrives.
  const state: State = loaded.key === key ? loaded : { key, status: "loading" };

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { browserApi } = await import("@/lib/api/browser");
        const { data, error } = await browserApi().GET("/v1/store/styles/{code}", { params: { path: { code } } });
        if (!live) return;
        setLoaded(data && !error ? { key, status: "ready", style: data } : { key, status: "error" });
      } catch {
        if (live) setLoaded({ key, status: "error" });
      }
    })();
    return () => {
      live = false;
    };
  }, [code, key]);

  // C0: under a size search, the API's fit of this style (its rule, not the browser's): the inside size it recommends.
  const [fit, setFit] = useState<{ key: string; fit: Fit | null }>({ key: "", fit: null });
  const fitKey = `${code}:${size ?? ""}`;
  useEffect(() => {
    if (!size) return;
    let live = true;
    (async () => {
      try {
        const { browserApi } = await import("@/lib/api/browser");
        const { data } = await browserApi().GET("/v1/store/styles", {
          params: { query: { q: code, size, limit: 5 } },
        });
        if (live) setFit({ key: fitKey, fit: data?.data.find((c) => c.code === code)?.fit ?? null });
      } catch {
        if (live) setFit({ key: fitKey, fit: null });
      }
    })();
    return () => {
      live = false;
    };
  }, [code, size, fitKey]);
  const shownFit = size && fit.key === fitKey ? fit.fit : null;
  const product = cmOfSize(size);

  const style = state.status === "ready" ? state.style : null;
  const name = style ? (locale === "en" ? style.nameEn || style.nameTh : style.nameTh || style.nameEn) : code;
  const href = style ? styleHref(style.code, name) : null;
  const here = typeof window === "undefined" ? "/styles" : `${window.location.pathname}${window.location.search}`;

  const range = (min: number | null, max: number | null) =>
    min !== null && max !== null
      ? t("detail.range", { min: format.number(Math.ceil(min)), max: format.number(Math.floor(max)) })
      : null;

  // The shared helper formats and labels the API's (VAT-inclusive) figure; nothing is derived here.
  const shownPrice = displayPrice(figuresOf(style?.startingPrice?.unitPrice), "incl", format.thb, {
    incl: t("library.vatLabelIncl"),
    excl: t("library.vatLabelExcl"),
  });

  const facts = style
    ? [
        ...style.sizeRanges
          .map((r) => {
            const l = range(r.minLMm, r.maxLMm);
            const w = range(r.minWMm, r.maxWMm);
            const h = range(r.minHMm, r.maxHMm);
            return l && w
              ? {
                  term: `${t("library.quickViewSize")} · ${facetLabel(words, "materialClass", r.materialClass)}`,
                  description: <span className="tabular-nums">{[l, w, h].filter(Boolean).join(" × ")}</span>,
                }
              : null;
          })
          .filter((f): f is NonNullable<typeof f> => f !== null),
        ...(style.fitRange
          ? [
              {
                term: t("library.quickViewFitRange"),
                description: (
                  <span className="tabular-nums">
                    {t("library.quickViewFitRangeValue", {
                      l: `${cmOf(style.fitRange.minLMm)}–${cmOf(style.fitRange.maxLMm)}`,
                      w: `${cmOf(style.fitRange.minWMm)}–${cmOf(style.fitRange.maxWMm)}`,
                      h: `${cmOf(style.fitRange.minHMm)}–${cmOf(style.fitRange.maxHMm)}`,
                    })}
                  </span>
                ),
              },
            ]
          : []),
        { term: t("library.quickViewMaterial"), description: facetLabel(words, "materialClass", style.materialClass) },
        ...(style.moqUnits
          ? [
              {
                term: t("library.quickViewMoq"),
                description: (
                  <span className="tabular-nums">
                    {t("library.quickViewMoqValue", { count: format.number(style.moqUnits) })}
                  </span>
                ),
              },
            ]
          : []),
        ...(style.leadTime
          ? [
              {
                term: t("library.quickViewLeadTime"),
                description: t("library.quickViewLeadTimeValue", {
                  min: style.leadTime.minDays,
                  max: style.leadTime.maxDays,
                }),
              },
            ]
          : []),
        {
          term: t("library.quickViewPricing"),
          description:
            style.pricePath === "instant" ? t("library.quickViewPricingInstant") : t("library.quickViewPricingQuote"),
        },
        ...(style.startingPrice
          ? [
              {
                term: t("library.cardFrom"),
                description: (
                  <span className="tabular-nums">
                    {shownPrice ? t("library.cardPrice", { price: shownPrice.amount }) : null}{" "}
                    <span className="text-muted">{shownPrice?.vatLabel}</span>{" "}
                    <span className="text-muted">
                      {t("library.cardAtQuantity", { quantity: format.number(style.startingPrice.quantity) })}
                    </span>
                  </span>
                ),
              },
            ]
          : []),
        ...(style.useCases.length
          ? [
              {
                term: t("library.quickViewUseCases"),
                description: style.useCases.map((u) => facetLabel(words, "useCase", u)).join(", "),
              },
            ]
          : []),
        ...(style.recyclable || style.plasticFree
          ? [
              {
                term: t("library.quickViewEco"),
                description: [
                  style.recyclable ? t("library.ecoRecyclable") : null,
                  style.plasticFree ? t("library.ecoPlasticFree") : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              },
            ]
          : []),
        ...(taxInvoiceNote ? [{ term: t("library.quickViewTaxInvoice"), description: taxInvoiceNote }] : []),
      ]
    : [];

  return (
    <Sheet
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={name}
      description={
        style ? (
          <>
            <span className="font-mono">{style.code}</span> · {facetLabel(words, "category", style.category)}
          </>
        ) : undefined
      }
      closeLabel={t("library.quickViewClose")}
      className="max-sm:inset-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:rounded-none sm:w-[min(40rem,calc(100vw-2rem))]"
      footer={
        href ? (
          <Button asChild variant="ghost" iconEnd="arrow-right" className="ms-auto">
            <Link href={href} onClick={() => trackCatalog("catalog_cta", { style_code: code, cta: "page" })}>
              {t("library.quickViewFullPage")}
            </Link>
          </Button>
        ) : undefined
      }
    >
      {state.status === "loading" ? (
        <p className="text-muted flex items-center gap-2 py-10 text-sm" role="status">
          <Spinner label={t("library.quickViewLoading")} size={18} /> {t("library.quickViewLoading")}
        </p>
      ) : state.status === "error" ? (
        <div className="flex flex-col items-start gap-3 py-8" role="alert">
          <p className="text-sm">{t("library.quickViewError")}</p>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            {t("library.retry")}
          </Button>
        </div>
      ) : style ? (
        <div className="flex flex-col gap-6">
          {style.pricePath === "instant" ? (
            <Badge tone="instant" icon="zap" className="self-start">
              {t("library.quickViewInstant")}
            </Badge>
          ) : null}
          {shownFit && product ? (
            <div
              className="border-primary/30 bg-primary-subtle text-primary-subtle-fg rounded-card flex items-start gap-2.5 border p-3 text-sm"
              data-quick-view-fit=""
            >
              <Icon name="check" size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
              <p>
                <b className="font-semibold">{t("library.fitTitle", { ...product })}</b>
                <br />
                <span className="tabular-nums">
                  {t("library.fitInside", {
                    l: cmOf(shownFit.insideLMm),
                    w: cmOf(shownFit.insideWMm),
                    h: cmOf(shownFit.insideHMm),
                  })}
                </span>
              </p>
            </div>
          ) : null}
          <VariantPicker
            compact
            style={style}
            name={name}
            actions={{
              productSlug: style.startingPrice?.catalogProductSlug ?? null,
              rfqHref: quoteHrefs[style.category]
                ? `${quoteHrefs[style.category]}${style.productTypeCode ? `?type=${encodeURIComponent(style.productTypeCode)}` : ""}`
                : null,
              onAction: (cta) => trackCatalog("catalog_cta", { style_code: style.code, cta }),
              quoteResponseDays: style.quoteResponseBusinessDays,
            }}
            dieline={{
              sizeRanges: style.sizeRanges,
              signedIn,
              signInHref: `/sign-in?returnTo=${encodeURIComponent(`${href ?? here}#${DIELINE_FRAGMENT}`)}`,
              orderHref: style.startingPrice ? configureHref(style.startingPrice.catalogProductSlug) : null,
            }}
          />
          <section aria-labelledby="quick-view-spec">
            <h2 id="quick-view-spec" className="mb-3 text-lg font-semibold">
              {t("library.quickViewSpec")}
            </h2>
            <DescriptionList items={facts} columns={1} />
            {style.startingPrice ? <p className="text-muted mt-3 text-xs">{t("library.quickViewVat")}</p> : null}
          </section>
        </div>
      ) : null}
    </Sheet>
  );
}
