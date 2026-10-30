"use client";

import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import type { StyleDetail } from "@/features/customer/catalog/api.server";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { Badge } from "@/ui/components/Badge";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Button } from "@/ui/components/Button";
import { Spinner } from "@/ui/components/Spinner";
import { MobileActionBar } from "@/ui/components/MobileActionBar";
import { ProductPlate } from "@/ui/components/ProductIllustration";
import { cn } from "@/ui/lib/cn";

import type { DielineDownloadProps } from "./DielineDownload";
import { DielineDownloadEntry } from "./DielineDownloadEntry";
import { VariantActions, type VariantActionsProps } from "./VariantActions";
import { axisLabel, valueLabel, type StylesT } from "./labels";
import { illustrationOf } from "./illustration";
import { previewSrc } from "./paths";
import { change, optionsOf, selectionOf, variantOf, type Selection } from "./variants";

const StylePreview3D = dynamic(() => import("./StylePreview3D"), {
  ssr: false,
  loading: () => <Loading3D />,
});

function Loading3D() {
  const t = useTranslations("styles.detail");
  return (
    <p className="text-muted flex items-center gap-2 text-sm" role="status">
      <Spinner label={t("loading3d")} /> {t("loading3d")}
    </p>
  );
}

/**
 * Toggles for each structural option of a style (U3.5 §2) over the API's publishable variants, the
 * chosen variant's code and price path, the API's rendered thumbnail of it when there is one, and
 * the engine's 3D model on request. An option that cannot go with the rest is disabled and says
 * what it conflicts with.
 */
export function VariantPicker({
  style,
  name,
  actions,
  dieline,
  initialCode,
  compact = false,
  head,
  below,
  besidePanel,
}: {
  style: StyleDetail;
  name: string;
  /** The variant chosen on arrival (`?v=` — a card of the variants grid, D-410); else the first. */
  initialCode?: string;
  /** The free dieline of the chosen variant (U2.F2), when offered. */
  dieline?: Omit<DielineDownloadProps, "variantCode">;
  /** Where the chosen variant goes: the configurator or a quotation, and the studio (D-407). */
  actions: Omit<VariantActionsProps, "base" | "variant">;
  /** One column — inside the library's quick view, which is narrower than a page. */
  compact?: boolean;
  /**
   * The style's own head (code, name, option count, save/compare) at the top of the configuration panel — the
   * page's layout (Project A): the picture on the left, the panel that names and configures it on the right.
   */
  head?: React.ReactNode;
  /**
   * What follows the picture in its column on a wide screen (the style's facts and sizes), so the left column does
   * not end in an empty area beside a tall panel; under the panel on a narrower screen.
   */
  below?: React.ReactNode;
  /** Under the panel in the right column (the style's feature links): short, and part of choosing. */
  besidePanel?: React.ReactNode;
}) {
  const t = useTranslations("styles") as unknown as StylesT & ReturnType<typeof useTranslations>;
  const locale = useLocale();
  const id = useId();
  const [selection, setSelection] = useState<Selection>(() => {
    const first = style.variants.find((v) => v.code === initialCode) ?? style.variants[0];
    return first ? selectionOf(first, style.axes) : {};
  });
  const [show3d, setShow3d] = useState(false);
  const [pictureView, setPictureView] = useState<"photo" | "dieline">("photo");
  const variant = variantOf(style.variants, selection);
  // The style's photo (D-426) leads; the engine's thumbnails and drawing follow.
  const photo = storeImageSrc(style.photo?.url);
  const thumb =
    style.assets.find((a) => a.variantCode === variant?.code && a.kind === "thumbnail_3d") ??
    style.assets.find((a) => a.variantCode === null && a.kind === "thumbnail_3d") ??
    style.assets.find((a) => a.variantCode === null && a.kind === "thumbnail_2d");
  // The "แบบคลี่" view exists only when the API holds a dieline drawing for the style (never the engine's stand-in).
  const dielineAsset =
    style.assets.find((a) => a.variantCode === variant?.code && a.kind === "dieline_svg") ??
    style.assets.find((a) => a.variantCode === null && a.kind === "dieline_svg");
  const describe = (axis: string, value: unknown) =>
    Array.isArray(value)
      ? value.length
        ? value.map((v) => valueLabel(t, axis, String(v))).join(" + ")
        : t("detail.noneSelected")
      : valueLabel(t, axis, String(value));

  return (
    // Project A: on a page, the picture (7 of 12 columns) with the style's facts and sizes under it, beside the
    // configuration panel (5 of 12) that holds the head, the options, the chosen variant on the brand tint and its
    // one primary action. One column in the quick view and below `lg`: picture, panel, then the facts.
    <div
      className={
        compact
          ? "flex flex-col gap-6"
          : "grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:grid-rows-[auto_1fr] lg:gap-8"
      }
    >
      <section
        aria-labelledby={`${id}-preview`}
        className={cn("flex min-w-0 flex-col gap-3", !compact && "lg:col-start-1 lg:row-start-1")}
      >
        <h2 id={`${id}-preview`} className={compact ? "text-lg font-semibold" : "sr-only"}>
          {t("detail.preview")}
        </h2>
        <div
          className={cn(
            "border-border bg-surface rounded-panel flex min-h-64 items-center justify-center overflow-hidden border p-3",
            !compact && "md:min-h-[26rem]",
          )}
        >
          {pictureView === "dieline" && dielineAsset && !show3d ? (
            // eslint-disable-next-line @next/next/no-img-element -- a signed URL on the API's file host
            <img
              src={dielineAsset.url}
              alt={t("detail.thumbnailAlt", { name, code: variant?.code ?? style.code })}
              width={640}
              height={480}
              className="bg-surface aspect-[4/3] h-auto w-full max-w-full object-contain p-4"
            />
          ) : show3d && variant ? (
            <StylePreview3D code={style.code} options={variant.options} name={variant.code} />
          ) : photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- the API's public image, through the BFF
            <img
              src={photo}
              alt={style.photo ? pick(locale, style.photo.alt.th, style.photo.alt.en) : name}
              width={640}
              height={640}
              className="h-auto max-w-full"
            />
          ) : thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- a signed URL on the API's file host (ProductCard)
            <img
              src={thumb.url}
              alt={t("detail.thumbnailAlt", { name, code: variant?.code ?? style.code })}
              width={640}
              height={480}
              className="h-auto max-w-full"
            />
          ) : variant ? (
            // The engine's flat drawing of the chosen variant until the API renders its thumbnail (D-410).
            // eslint-disable-next-line @next/next/no-img-element -- an SVG this app draws
            <img
              src={previewSrc(style.code, variant.options)}
              alt={t("detail.thumbnailAlt", { name, code: variant.code })}
              width={640}
              height={480}
              className="bg-surface aspect-[4/3] h-auto w-full max-w-full object-contain p-4"
            />
          ) : (
            <ProductPlate family={illustrationOf(style)} className="w-full" />
          )}
        </div>
        {pictureView === "dieline" && dielineAsset && !show3d ? (
          <p className="text-muted text-xs" data-dieline-legend="">
            {t("detail.dielineLegend")}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          {dielineAsset && !show3d ? (
            <SegmentedControl
              label={t("detail.viewLabel")}
              size="sm"
              value={pictureView}
              onValueChange={setPictureView}
              options={[
                { value: "photo", label: t("detail.viewPhoto") },
                { value: "dieline", label: t("detail.viewDieline") },
              ]}
            />
          ) : null}
          {!show3d ? (
            <Button variant="secondary" iconStart="box" onClick={() => setShow3d(true)} disabled={!variant}>
              {t("detail.show3d")}
            </Button>
          ) : null}
        </div>
      </section>

      {/* The right column: the panel and what helps choose with it (the feature links), sticky under the header on
          a wide screen while the picture and the facts scroll beside it. */}
      <div
        className={cn(
          "flex min-w-0 flex-col gap-6",
          !compact &&
            "lg:sticky lg:top-[calc(var(--site-sticky-top)+1.25rem)] lg:col-start-2 lg:row-span-2 lg:row-start-1",
        )}
      >
        <section
          aria-labelledby={`${id}-options`}
          className={cn(
            "flex min-w-0 flex-col gap-5",
            !compact && "border-border bg-surface rounded-panel border p-5 md:p-6",
          )}
        >
          {head ? <div className="border-border border-b pb-5">{head}</div> : null}
          <div>
            <h2 id={`${id}-options`} className="text-lg font-semibold">
              {t("detail.options")}
            </h2>
            <p className="text-muted text-sm">{t("detail.optionsIntro")}</p>
          </div>
          {style.axes.map((axis) => {
            const options = optionsOf(axis, selection, style.variants);
            const chosen = selection[axis.axis];
            return (
              <fieldset key={axis.axis} className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">{axisLabel(t, axis.axis)}</legend>
                <div className="flex flex-wrap gap-2">
                  {options.map((option) => {
                    const on = Array.isArray(chosen) ? chosen.includes(option.value) : chosen === option.value;
                    const reason = option.available
                      ? undefined
                      : t("detail.unavailable", {
                          choice:
                            option.conflicts.map((a) => `${axisLabel(t, a)} ${describe(a, selection[a])}`).join(", ") ||
                            axisLabel(t, axis.axis),
                        });
                    const reasonId = `${id}-${axis.axis}-${option.value}`;
                    return (
                      <div key={option.value} className="flex flex-col">
                        <button
                          type="button"
                          role={axis.multiSelect ? "checkbox" : "radio"}
                          aria-checked={on}
                          aria-disabled={!option.available || undefined}
                          aria-describedby={reason ? reasonId : undefined}
                          onClick={() => option.available && setSelection((s) => change(s, axis, option.value))}
                          className={cn(
                            "focus-visible:ring-focus-ring rounded-control min-h-10 border px-3.5 py-1.5 text-sm outline-none focus-visible:ring-2",
                            on
                              ? "border-primary bg-primary-subtle text-primary-subtle-fg ring-primary font-medium ring-1 ring-inset"
                              : "border-border hover:bg-bg-subtle",
                            !option.available &&
                              "text-muted cursor-not-allowed line-through opacity-70 hover:bg-transparent",
                          )}
                        >
                          {valueLabel(t, axis.axis, option.value)}
                        </button>
                        {reason ? (
                          <span id={reasonId} className="sr-only">
                            {reason}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {options.some((o) => !o.available) ? (
                  <ul className="text-muted text-xs">
                    {options
                      .filter((o) => !o.available)
                      .map((o) => (
                        <li key={o.value} aria-hidden="true">
                          {valueLabel(t, axis.axis, o.value)}:{" "}
                          {t("detail.unavailable", {
                            choice:
                              (o.available ? [] : o.conflicts)
                                .map((a) => `${axisLabel(t, a)} ${describe(a, selection[a])}`)
                                .join(", ") || axisLabel(t, axis.axis),
                          })}
                        </li>
                      ))}
                  </ul>
                ) : null}
              </fieldset>
            );
          })}

          {/* The chosen variant on the brand tint: its code, its way to a price and its actions. */}
          <div className="bg-primary-subtle flex flex-col gap-2 rounded-xl p-4" aria-live="polite">
            <p className="text-sm font-semibold">{t("detail.variant")}</p>
            {variant ? (
              <>
                <p className="text-sm tabular-nums">{t("detail.variantCode", { code: variant.code })}</p>
                <p className="text-sm">
                  <span className="text-muted me-2">{t("detail.price")}</span>
                  <Badge
                    tone={variant.pricePath === "instant" ? "instant" : "info"}
                    icon={variant.pricePath === "instant" ? "zap" : undefined}
                  >
                    {t(`pricePaths.${variant.pricePath}`)}
                  </Badge>
                </p>
              </>
            ) : null}
            {variant ? (
              <div className="pt-1">
                <VariantActions
                  base={style.code}
                  variant={variant}
                  designLabel={compact ? t("detail.startDesign") : undefined}
                  {...actions}
                />
              </div>
            ) : null}
          </div>
          {dieline && variant ? <DielineDownloadEntry variantCode={variant.code} {...dieline} /> : null}
        </section>
        {!compact && besidePanel ? besidePanel : null}
      </div>
      {!compact && below ? (
        <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-2">{below}</div>
      ) : null}
      {/* A phone keeps the chosen variant's one primary action in reach at the foot of the screen. */}
      {!compact && variant ? (
        <MobileActionBar>
          <VariantActions base={style.code} variant={variant} primaryOnly {...actions} />
        </MobileActionBar>
      ) : null}
    </div>
  );
}
