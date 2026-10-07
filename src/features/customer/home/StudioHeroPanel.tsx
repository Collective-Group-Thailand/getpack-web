"use client";

import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";

import { buildCalculateBody } from "@/features/customer/configurator/build";
import { useLivePrice } from "@/features/customer/configurator/pricing";
import { initialState, readyToPrice, seedFromDesign } from "@/features/customer/configurator/state";
import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";

import { isoBox, MATERIAL_TINT } from "./iso-box";
import type { HeroShapeSetup } from "./studio-hero.server";

const PRINTS = ["none", "one", "full"] as const;
/** The panel asks for a price once the customer pauses for this long (Phase 4 §4.3). */
const PRICE_DELAY_MS = 250;
/** The drawing when there is no catalogue to show: the board's first size, 18 × 12 × 5 cm. */
const NO_SIZE = { code: "", l: 180, w: 120, d: 50 };

type Print = (typeof PRINTS)[number];

/**
 * The hero's working mini studio (Phase 4 §4.3, the "Main" board): shape, size, board, print and
 * quantity as chips, the box drawn isometrically from them, and the price.
 *
 * Every chip is the catalogue's (`studio-hero.server.ts`): the shapes are box products priced
 * online, and each one's sizes, boards, inks and quantities come from its own configurator — the
 * endpoint `/configure` reads. The price is the configurator's, by construction: the panel writes
 * its choices as the query `/configure/<slug>` reads (`seedFromDesign`), builds the configurator's
 * own body from it and asks the same `store.quotes.calculate` — so the configurator opened on that
 * query shows this price (an e2e test holds them together). Nothing here computes money.
 */
export function StudioHeroPanel({ setup }: { setup: HeroShapeSetup[] }) {
  const t = useTranslations("home.panel");
  const format = useFormat();
  const ids = useId();
  const [shapeIdx, setShapeIdx] = useState(0);
  const current = setup[shapeIdx] ?? null;
  const [sizeCode, setSizeCode] = useState(current?.sizes[0]?.code ?? "");
  const [materialId, setMaterialId] = useState(
    current?.materials.find((option) => option.isDefault)?.id ?? current?.materials[0]?.id ?? "",
  );
  const [print, setPrint] = useState<Print>("one");
  const [qty, setQty] = useState<number>(current?.quantities[0] ?? 0);

  // A choice the newly chosen shape does not offer falls to that shape's own first one.
  const size = current?.sizes.find((entry) => entry.code === sizeCode) ?? current?.sizes[0] ?? NO_SIZE;
  const material =
    current?.materials.find((option) => option.id === materialId) ??
    current?.materials.find((option) => option.isDefault) ??
    current?.materials[0] ??
    null;
  const quantity = current?.quantities.includes(qty) ? qty : (current?.quantities[0] ?? 0);
  // The front inks as one string, so the memos below see a value, not a new array each render.
  const inks = print === "none" ? "" : (current?.inks[print]?.join(",") ?? null);
  const configurator = current?.configurator ?? null;

  // The query the configurator reads — the panel's state, as a link and as the priced body.
  const query = useMemo(() => {
    if (!configurator || !size.code) return null;
    return {
      ...(configurator.patterns[0] ? { pattern: configurator.patterns[0].id } : {}),
      ...(material ? { material: material.id } : {}),
      size: size.code,
      qty: String(quantity),
      from: "home",
      ink: inks ? inks : "none",
    };
  }, [configurator, material, size.code, quantity, inks]);

  const body = useMemo(() => {
    if (!configurator || !query || inks === null) return null;
    const state = initialState(configurator, seedFromDesign(configurator, query));
    if (state.quantity !== quantity || !readyToPrice(configurator, state)) return null;
    return buildCalculateBody(configurator, state);
  }, [configurator, query, inks, quantity]);
  const price = useLivePrice(body, PRICE_DELAY_MS);
  const step = price.data?.steps.find((candidate) => candidate.quantity === quantity && candidate.instant) ?? null;

  const studioQuery = new URLSearchParams({
    ...(current ? { product: current.productSlug } : {}),
    ...(current?.styleId ? { style: current.styleId, l: String(size.l), w: String(size.w), h: String(size.d) } : {}),
    ...(query?.material ? { material: query.material } : {}),
    ...(query?.pattern ? { pattern: query.pattern } : {}),
  });
  const studioHref = `/studio/new?${studioQuery.toString()}`;
  const configureHref = current && query ? `/configure/${current.productSlug}?${new URLSearchParams(query)}` : null;

  const cm = (mm: number) => format.number(mm / 10, { maximumFractionDigits: 1 });
  const sizeName = t("sizeChip", { w: cm(size.l), d: cm(size.w), h: cm(size.d) });
  const box = isoBox(
    { w: size.l, d: size.w, h: size.d },
    current?.drawing ?? "mailer",
    MATERIAL_TINT[material?.tint ?? "kraft350"],
    print,
  );
  const validityDays = configurator?.quoteValidityDays ?? null;

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className="border-border bg-surface rounded-panel shadow-panel overflow-hidden border"
    >
      <div className="border-border flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b px-4.5 py-3">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="bg-primary size-2 rounded-full" />
          <h2 id={`${ids}-title`} className="text-sm font-semibold tracking-normal">
            {t("title")}
          </h2>
          <span className="text-muted text-[13px]">{t("unsaved")}</span>
        </div>
        <div className="text-muted flex items-center gap-3.5 text-[13px]">
          <span>{current ? t("summary", { shape: current.name, size: sizeName }) : sizeName}</span>
          <Link href={studioHref} className="text-fg border-b border-current font-medium">
            {t("fullscreen")}
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2">
        <div className="pk-line-grid bg-bg relative grid h-60 place-items-center md:h-auto md:min-h-[420px]">
          <svg
            viewBox="-175 -150 350 300"
            className="h-auto max-h-full w-[94%] md:max-h-[390px]"
            role="img"
            aria-label={t("previewLabel", { shape: current?.name ?? t("box"), size: sizeName })}
          >
            <ellipse {...box.shadow} fill="rgb(60 40 20 / 0.16)" />
            <path d={box.left} fill={box.fills.left} />
            <path d={box.right} fill={box.fills.right} />
            <path d={box.top} fill={box.fills.top} />
            <path d={box.seam} fill="none" stroke="rgb(70 45 20 / 0.5)" strokeWidth={1.4} />
            {box.logo ? (
              <>
                <path d={box.logo.block} fill={box.logo.fill} />
                <path d={box.logo.lines} fill="none" stroke={box.logo.fill} strokeWidth={1.2} />
              </>
            ) : null}
            <g fill="none" stroke="rgb(60 40 20 / 0.3)" strokeWidth={1}>
              <path d={box.left} />
              <path d={box.right} />
              <path d={box.top} />
            </g>
          </svg>
        </div>

        <div className="flex flex-col px-4.5 pt-3.5 pb-4.5">
          {current ? (
            <>
              <Row label={t("labels.shape")} first>
                {setup.map((entry, index) => (
                  <Chip key={entry.productSlug} pressed={shapeIdx === index} onClick={() => setShapeIdx(index)}>
                    {entry.name}
                  </Chip>
                ))}
              </Row>
              <Row label={t("labels.size")}>
                {current.sizes.map((entry) => (
                  <Chip key={entry.code} pressed={size.code === entry.code} onClick={() => setSizeCode(entry.code)}>
                    {t("sizeChip", { w: cm(entry.l), d: cm(entry.w), h: cm(entry.d) })}
                  </Chip>
                ))}
                <Link href="/studio?custom=1" className="self-center border-b border-current text-[13px] font-medium">
                  {t("custom")}
                </Link>
              </Row>
              {current.materials.length > 0 ? (
                <Row label={t("labels.material")}>
                  {current.materials.map((option) => (
                    <Chip key={option.id} pressed={material?.id === option.id} onClick={() => setMaterialId(option.id)}>
                      {option.name}
                    </Chip>
                  ))}
                </Row>
              ) : null}
              <Row label={t("labels.print")}>
                {PRINTS.map((key) => (
                  <Chip
                    key={key}
                    pressed={print === key}
                    disabled={key !== "none" && current.inks[key] === null}
                    onClick={() => setPrint(key)}
                  >
                    {t(`prints.${key}`)}
                  </Chip>
                ))}
              </Row>
              <Row label={t("labels.quantity")}>
                {current.quantities.map((value) => (
                  <Chip key={value} pressed={quantity === value} onClick={() => setQty(value)}>
                    {format.number(value)}
                  </Chip>
                ))}
              </Row>
            </>
          ) : null}

          <div className="border-fg mt-auto border-t pt-4" aria-live="polite" aria-busy={price.pending || undefined}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-h-[5.25rem] min-w-0">
                {!current ? (
                  <p className="text-muted max-w-[22em] text-sm">{t("noSetup")}</p>
                ) : step?.unitPrice ? (
                  <>
                    <p className="text-muted text-[13px]">{t("priceCaption", { qty: format.number(quantity) })}</p>
                    <p
                      className={cn(
                        "mt-0.5 text-[1.875rem] leading-tight font-semibold tracking-[-0.02em] tabular-nums transition-opacity",
                        price.pending && "opacity-60",
                      )}
                    >
                      {format.thb(step.unitPrice)}{" "}
                      {step.productAmount ? (
                        <small className="text-muted text-sm font-normal tracking-normal">
                          {t("total", { total: format.thb(step.productAmount) })}
                        </small>
                      ) : null}
                    </p>
                    <p className="text-muted text-[13px]">
                      {[
                        step.leadTimeDays !== null ? t("lead", { days: step.leadTimeDays }) : null,
                        validityDays !== null ? t("lock", { days: validityDays }) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </>
                ) : body === null || price.isError || (price.data && !step) ? (
                  <p className="text-muted max-w-[22em] text-sm">{t("unpriced")}</p>
                ) : (
                  <p className="text-muted text-sm">{t("calculating")}</p>
                )}
              </div>
              <Link href={studioHref} className={buttonVariants({ size: "md", className: "whitespace-nowrap" })}>
                {t("continue")}
              </Link>
            </div>
            {/* Always takes its line, so the panel does not grow when the price arrives (CLS). */}
            {configureHref && step?.unitPrice ? (
              <Link href={configureHref} className="text-muted mt-2 inline-block border-b border-current text-[13px]">
                {t("configure")}
              </Link>
            ) : (
              <span aria-hidden="true" className="mt-2 inline-block text-[13px]">
                &nbsp;
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, first = false, children }: { label: string; first?: boolean; children: React.ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("grid grid-cols-[4.5rem_1fr] items-center gap-3 py-2.5", first ? "pt-1" : "border-border border-t")}
    >
      <span aria-hidden="true" className="text-muted text-[13px]">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  pressed,
  disabled = false,
  title,
  onClick,
  children,
}: {
  pressed: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-control bg-surface inline-flex h-8 items-center border px-2.5 text-[13px] whitespace-nowrap",
        "focus-visible:ring-focus-ring duration-fast transition-colors outline-none focus-visible:ring-2",
        "disabled:cursor-not-allowed disabled:opacity-45",
        pressed ? "border-fg text-fg font-semibold" : "border-border text-muted hover:border-subtle",
      )}
    >
      {children}
    </button>
  );
}
