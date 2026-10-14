"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";

import { facetLabel, type StylesT } from "./labels";

type Basis = "internal" | "external" | "over_crease";
/**
 * The engine's three formats plus `ai`: the designer PDF delivered as an Illustrator file. The
 * vendored contract does not list `ai` until packio-api's next contract build is adopted
 * (`pnpm gen:api --adopt`), so the body is widened here — CONTRACT-REQUEST store.dielines.download-ai.
 */
type Format = Schemas["DrawingFormat"] | "ai";

export interface DielineDownloadProps {
  variantCode: string;
  sizeRanges: Schemas["StyleSizeRangeDto"][];
  signedIn: boolean;
  signInHref: string;
  /** Where to order this style (the configurator), for the nudge after a download. */
  orderHref: string | null;
}

const MM = /^\d{1,4}(\.\d)?$/;

/**
 * The free dieline of a variant at the customer's sizes (U2.F2, D-271): PDF, DXF or SVG, no plan
 * gate and no watermark, drawn by packio-api (`store.dielines.download`) within the style's range for
 * the material class — sizes entered on any basis are converted by the API. The PDF's layers are
 * explained; after a download the page says the box can be ordered as it is, never a paywall. A
 * signed-out visitor is asked to sign in (the API counts downloads per customer).
 */
export function DielineDownload({ variantCode, sizeRanges, signedIn, signInHref, orderHref }: DielineDownloadProps) {
  const t = useTranslations("styles.dieline");
  const words = useTranslations("styles") as unknown as StylesT;
  const locale = useLocale() as "th" | "en";
  const [material, setMaterial] = useState(sizeRanges[0]?.materialClass ?? "");
  const [basis, setBasis] = useState<Basis>("internal");
  const [format, setFormat] = useState<Format>("pdf");
  const [size, setSize] = useState({ l: "", w: "", h: "" });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<Schemas["DielineDownloadDto"] | null>(null);

  if (!sizeRanges.length) return null;
  const flat = sizeRanges.find((r) => r.materialClass === material)?.maxHMm === null;
  const ready = MM.test(size.l) && MM.test(size.w) && (flat || MM.test(size.h));

  const download = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const { data } = await browserApi().POST("/v1/store/dielines/downloads", {
        body: {
          variantCode,
          materialClass: material,
          measurementBasis: basis,
          format: format as Schemas["DrawingFormat"],
          lengthMm: Number(size.l),
          widthMm: Number(size.w),
          heightMm: flat ? 0 : Number(size.h),
        },
      });
      setDone(data!);
      const a = document.createElement("a");
      a.href = data!.url;
      a.download = data!.fileName;
      a.rel = "noopener";
      a.click();
    } catch (error) {
      setProblem(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  };

  const range = sizeRanges.find((r) => r.materialClass === material);
  const span = (min: number | null, max: number | null) =>
    min !== null && max !== null ? `${formatNumber(min, locale)}–${formatNumber(max, locale)}` : "—";

  return (
    <section aria-labelledby="dieline-download" className="bg-surface border-border rounded-card flex flex-col gap-3 border p-4">
      <div>
        <h3 id="dieline-download" className="text-sm font-semibold">
          {t("title")}
        </h3>
        <p className="text-muted text-sm">{t("body")}</p>
      </div>
      {!signedIn ? (
        <Button asChild variant="secondary" iconStart="log-in">
          <Link href={signInHref}>{t("signIn")}</Link>
        </Button>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("material")}>
              <SearchableSelect
                value={material}
                onValueChange={setMaterial}
                options={sizeRanges.map((r) => ({
                  value: r.materialClass,
                  label: facetLabel(words, "materialClass", r.materialClass),
                }))}
              />
            </Field>
            <Field label={t("basis")}>
              <SearchableSelect
                value={basis}
                onValueChange={(v) => setBasis(v as Basis)}
                options={(["internal", "external", "over_crease"] as const).map((value) => ({
                  value,
                  label: t(`bases.${value}`),
                }))}
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["l", "w", "h"] as const).map((k) =>
              k === "h" && flat ? null : (
                <Field
                  key={k}
                  label={t(`sizes.${k}`)}
                  hint={
                    range
                      ? t("range", {
                          span: span(
                            range[`min${k.toUpperCase()}Mm` as "minLMm"],
                            range[`max${k.toUpperCase()}Mm` as "maxLMm"],
                          ),
                        })
                      : undefined
                  }
                >
                  <Input
                    inputMode="decimal"
                    value={size[k]}
                    onChange={(event) => setSize((s) => ({ ...s, [k]: event.target.value.trim() }))}
                  />
                </Field>
              ),
            )}
          </div>
          <SegmentedControl
            label={t("format")}
            value={format}
            onValueChange={setFormat}
            options={(["pdf", "ai", "dxf", "svg"] as const).map((value) => ({ value, label: value.toUpperCase() }))}
          />
          <Button iconStart="download" loading={busy} disabled={!ready} onClick={() => void download()}>
            {t("download")}
          </Button>
          {/* How to open what comes down, in three lines per format (U5.4 §2). */}
          <ol
            className="text-muted list-decimal ps-5 text-xs"
            aria-label={t("guideTitle", { format: format.toUpperCase() })}
          >
            {(["1", "2", "3"] as const).map((n) => (
              <li key={n}>{t(`guide.${format}.${n}`)}</li>
            ))}
          </ol>
          {problem ? <Callout tone="danger" title={problem} /> : null}
          {done ? (
            <Callout tone="success" title={t("done", { file: done.fileName })}>
              <p className="text-sm">
                {t("drawn", {
                  l: formatNumber(done.drawn.lengthMm, locale),
                  w: formatNumber(done.drawn.widthMm, locale),
                  h: formatNumber(done.drawn.heightMm, locale),
                })}
                {done.remainingToday !== null ? ` · ${t("remaining", { count: done.remainingToday })}` : ""}
              </p>
              {orderHref ? (
                <p className="mt-2 text-sm">
                  {t("nudge")}{" "}
                  <Link href={orderHref} className="text-primary underline underline-offset-4">
                    {t("order")}
                  </Link>
                </p>
              ) : null}
            </Callout>
          ) : null}
        </>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">{t("layersTitle")}</summary>
        <ul className="text-muted mt-2 flex flex-col gap-1">
          {(["CutContour", "Crease", "Perf", "Glue", "Bleed", "Safe", "HalfCut"] as const).map((layer) => (
            <li key={layer}>
              <span className="font-mono">{layer}</span> — {t(`layers.${layer}`)}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
