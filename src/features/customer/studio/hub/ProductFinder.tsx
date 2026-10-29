"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { useDebounced } from "@/features/customer/configurator/pricing";
import { BoxPreview } from "@/features/designer/components/BoxPreview";
import { formatDimensions } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { trackStudioHub } from "@/lib/analytics";
import { buttonVariants } from "@/ui/components/Button";
import { DimensionInput, type LengthUnit } from "@/ui/components/DimensionInput";
import { cn } from "@/ui/lib/cn";

import { studioHref } from "../paths";
import { suggestBoxes, type ShipsBy } from "../suggest";

const SHIPS: ShipsBy[] = ["parcel", "pallet", "shelf"];
/** Results follow a pause in typing (the finder is live, studio redesign Phase 1 item 4). */
const LIVE_DELAY_MS = 300;

/**
 * "มีสินค้าแล้ว อยากได้กล่อง" inline on `/studio` (replaces the old hub's modal): the product's size in มม. / ซม. /
 * นิ้ว (kept in mm) and what the box is for → the existing recommendation (`suggestBoxes`, U4.2 §2 — pure geometry
 * over the engine's styles: inside size = product + the designer's clearance, the engine's rules must accept it,
 * ordered by how the family suits the use, then by the smallest sheet) with each reason and the recommended inside
 * size; "ออกแบบแบบนี้" opens the editor on that style and size. No price: the recommendation has none — the editor
 * prices the box once it is open. `?start=product` scrolls here.
 */
export function ProductFinder({ productSlug }: { productSlug: string | null }) {
  const t = useTranslations("studio.home.finder");
  const tDescribe = useTranslations("studio.describe");
  const tCategories = useTranslations("designer.setup.categories");
  const locale = useLocale() as "th" | "en";
  const ref = useRef<HTMLElement>(null);
  const [unit, setUnit] = useState<LengthUnit>("mm");
  const [size, setSize] = useState<Record<"l" | "w" | "h", number | null>>({ l: null, w: null, h: null });
  const [use, setUse] = useState<ShipsBy>("parcel");
  const live = useMemo(() => ({ size, use }), [size, use]);
  const asked = useDebounced(live, LIVE_DELAY_MS);
  const product = useMemo(
    () =>
      asked.size.l && asked.size.w && asked.size.h
        ? { length: asked.size.l, width: asked.size.w, height: asked.size.h }
        : null,
    [asked],
  );
  const results = useMemo(
    () => (product ? suggestBoxes(product, asked.use, null, locale) : null),
    [product, asked.use, locale],
  );

  const submitted = useRef<string | null>(null);
  useEffect(() => {
    if (!product) return;
    const key = `${product.length}:${product.width}:${product.height}:${asked.use}`;
    if (submitted.current === key) return;
    submitted.current = key;
    trackStudioHub("studio_finder_submit", { unit, use: asked.use });
  }, [product, asked.use, unit]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("start") === "product")
      ref.current?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <section
      ref={ref}
      id="finder"
      aria-labelledby="studio-finder"
      className="border-border bg-surface rounded-panel grid scroll-mt-24 overflow-hidden border lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
    >
      <div className="border-border flex flex-col gap-4 border-b p-5 md:p-6.5 lg:border-e lg:border-b-0">
        <h3 id="studio-finder" className="text-xl font-semibold">
          {t("title")}
        </h3>
        <p className="text-muted -mt-2 text-sm">{t("lead")}</p>
        <DimensionInput
          legend={<span className="sr-only">{tDescribe("size")}</span>}
          unit={unit}
          onUnitChange={setUnit}
          unitLabels={{ mm: tDescribe("units.mm"), cm: tDescribe("units.cm"), in: tDescribe("units.in") }}
          unitToggleLabel={tDescribe("unit")}
          onChange={(key, valueMm) => setSize((s) => ({ ...s, [key]: valueMm }))}
          axes={[
            { key: "l", label: tDescribe("axes.l"), valueMm: size.l },
            { key: "w", label: tDescribe("axes.w"), valueMm: size.w },
            { key: "h", label: tDescribe("axes.h"), valueMm: size.h },
          ]}
        />
        <div role="group" aria-labelledby="studio-finder-use">
          <span id="studio-finder-use" className="text-muted mb-1.5 block text-[12.5px]">
            {t("use")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {SHIPS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={use === value}
                onClick={() => setUse(value)}
                className={cn(
                  "rounded-control focus-visible:ring-focus-ring h-8.5 border px-3.5 text-[13.5px] outline-none focus-visible:ring-2",
                  use === value ? "bg-primary border-primary text-primary-fg" : "border-border text-muted bg-surface",
                )}
              >
                {tDescribe(`ships.${value}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-bg-subtle flex flex-col gap-3 p-5 md:p-6.5" aria-live="polite">
        {results === null ? (
          <p className="text-muted text-sm">{t("empty")}</p>
        ) : results.length === 0 ? (
          <p className="text-muted text-sm">{tDescribe("none")}</p>
        ) : (
          <>
            <b className="text-base font-semibold">{t("results", { count: results.length })}</b>
            <ol className="flex flex-col gap-2.5">
              {results.map((suggestion, index) => {
                const values = suggestion.spec.values as Record<string, number>;
                const inside = { length: values.length!, width: values.width!, height: values.height! };
                const href = studioHref({
                  product: productSlug,
                  style: suggestion.spec.styleId,
                  dims: { l: inside.length, w: inside.width, h: inside.height },
                  step: "design",
                });
                return (
                  <li
                    key={suggestion.spec.styleId}
                    className={cn(
                      "bg-surface rounded-card grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3.5 border p-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]",
                      index === 0 ? "border-primary" : "border-border",
                    )}
                  >
                    <span aria-hidden="true" className="bg-bg rounded-thumb grid h-13 place-items-center p-1 sm:h-16">
                      <BoxPreview
                        styleId={suggestion.spec.styleId}
                        values={suggestion.spec.values}
                        material={suggestion.spec.material}
                        label=""
                      />
                    </span>
                    <div className="min-w-0">
                      <b className="block text-[14.5px] font-semibold">
                        {suggestion.style.name[locale]}
                        {index === 0 ? ` · ${t("best")}` : ""}
                      </b>
                      <small className="text-muted block text-[12.5px]">
                        {suggestion.reasons
                          .filter((reason) => reason.code === "family" || reason.code === "advisor")
                          .map((reason) =>
                            reason.code === "family"
                              ? tDescribe(`reasons.family.${reason.shipsBy}`, { family: tCategories(reason.category) })
                              : tDescribe("reasons.advisor"),
                          )
                          .join(" · ")}
                      </small>
                      <small className="text-muted block text-[11.5px] tabular-nums">
                        {t("inside", { size: formatDimensions(inside, locale, { withUnit: true }) })}
                      </small>
                    </div>
                    <Link
                      href={href}
                      onClick={() =>
                        trackStudioHub("studio_finder_pick", { style: suggestion.spec.styleId, rank: index + 1 })
                      }
                      className={buttonVariants({
                        size: "sm",
                        variant: index === 0 ? "primary" : "secondary",
                        className: "col-span-2 sm:col-span-1",
                      })}
                    >
                      {t("design")}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}
