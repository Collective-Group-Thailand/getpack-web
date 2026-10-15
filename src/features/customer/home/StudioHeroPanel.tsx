"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { useDebounced } from "@/features/customer/configurator/pricing";
import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { queryKeys } from "@/lib/api/query-keys";
import { browserApi, isApiError } from "@/lib/api/browser";
import { buttonVariants } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";

import { isoBox, MATERIAL_TINT } from "./iso-box";
import { reconcile, requestOf, sameSelection, type HeroPriced, type HeroSelection } from "./studio-hero";
import type { HeroShape } from "./studio-hero.server";

const SHAPES = ["mailer", "lid", "tuck"] as const;
const BOARDS = ["kraft350", "art350", "corrE"] as const;
const PRINTS = ["none", "one", "full"] as const;
/** The panel asks for a price once the customer pauses for this long (Phase 4 §4.3). */
const PRICE_DELAY_MS = 250;
/** The drawing when there is no catalogue to show: the board's first size, 18 × 12 × 5 cm. */
const NO_SIZE = { id: "", lengthMm: 180, widthMm: 120, heightMm: 50 };
/** Degrees the box turns per pixel dragged, and per arrow-key press. */
const DEG_PER_PX = 0.6;
const DEG_PER_KEY = 15;

// The flat view needs the dieline engine: it loads on the first switch to it, not with the page.
const HeroDieline = dynamic(() => import("./HeroDieline"), { ssr: false });

/**
 * The hero's working mini studio (Phase 4 §4.3, the "Main" board): shape, size, board, print and
 * quantity as chips, the box drawn isometrically from them, and the price.
 *
 * Every chip is a hero preset (D-310, `store.catalog.getHeroPresets`): three short shapes, three
 * boards and the quantities the catalogue backs — a board or print the current shape does not
 * offer is shown, disabled. The price is `store.quotes.preview`, which prices the selection by the
 * `store.quotes.calculate` path, every part of a multi-part box included — the body `/configure`
 * sends for the same choices, so it opens on the same price. The panel opens on a selection the
 * server already priced (`initial`), so its first state is a price; only a change the customer
 * makes can meet "no instant price". Nothing here computes money.
 */
export function StudioHeroPanel({ shapes, initial }: { shapes: HeroShape[]; initial: HeroPriced | null }) {
  const t = useTranslations("home.panel");
  const format = useFormat();
  const ids = useId();
  const [selection, setSelection] = useState<HeroSelection | null>(initial?.selection ?? null);
  const [view, setView] = useState<"3d" | "flat">("3d");
  const [yaw, setYaw] = useState(0);
  const drag = useRef<{ x: number; yaw: number } | null>(null);
  const settled = useDebounced(selection, PRICE_DELAY_MS);
  const current = shapes.find((shape) => shape.id === selection?.shape) ?? null;
  const fresh = settled !== null && initial !== null && sameSelection(settled, initial.selection);
  const body = settled ? requestOf(settled, shapes) : null;

  const preview = useQuery({
    queryKey: [...queryKeys.zone("customer"), "hero-preview", body],
    queryFn: async (): Promise<HeroPriced> => {
      const { data } = await browserApi().POST("/v1/store/quotes/actions/preview", { body: body! });
      return { selection: settled!, preview: data! };
    },
    enabled: body !== null && !fresh,
    // The opening price is the server's; a later one stays up (marked updating) for the same shape only.
    initialData: fresh ? initial! : undefined,
    placeholderData: (previous) => (previous?.selection.shape === settled?.shape ? previous : undefined),
    staleTime: 60_000,
    retry: 1,
  });
  const pending = selection !== settled || preview.isFetching;
  const shown = preview.data ?? null;
  const priced = shown?.preview ?? null;

  const pick = (next: Partial<HeroSelection>) =>
    setSelection((prev) => (prev ? reconcile({ ...prev, ...next }, shapes) : prev));

  const size = current?.sizes.find((entry) => entry.id === selection?.sizeId) ?? current?.sizes[0] ?? NO_SIZE;
  const board = current?.materials.find((entry) => entry.id === selection?.material) ?? null;
  const inks = current?.prints.find((entry) => entry.id === selection?.print)?.inkIds ?? [];
  const cm = (mm: number) => format.number(mm / 10, { maximumFractionDigits: 1 });
  const sizeName = t("sizeChip", { w: cm(size.lengthMm), d: cm(size.widthMm), h: cm(size.heightMm) });
  const shapeName = current ? t(`shapes.${current.id}`) : t("box");
  const box = isoBox(
    { w: size.lengthMm, d: size.widthMm, h: size.heightMm },
    current?.id ?? "mailer",
    MATERIAL_TINT[board?.id ?? "kraft350"],
    selection?.print ?? "one",
    yaw,
  );

  const studioQuery = new URLSearchParams({
    ...(current ? { product: current.productSlug } : {}),
    ...(current?.styleId
      ? { style: current.styleId, l: String(size.lengthMm), w: String(size.widthMm), h: String(size.heightMm) }
      : {}),
    ...(board ? { material: board.materialId } : {}),
    ...(current ? { pattern: current.patternId } : {}),
  });
  const studioHref = `/studio/new?${studioQuery.toString()}`;
  // The query `/configure` reads (`seedFromDesign`): the same selection on the inside size, so it
  // builds the body the preview priced (every part printed alike) and shows this price.
  const configureHref =
    current && board && selection
      ? `/configure/${current.productSlug}?${new URLSearchParams({
          pattern: current.patternId,
          material: board.materialId,
          l: String(size.lengthMm),
          w: String(size.widthMm),
          d: String(size.heightMm),
          qty: String(selection.qty),
          from: "home",
          ink: inks.length ? inks.join(",") : "none",
        })}`
      : null;

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
          <span>{current ? t("summary", { shape: shapeName, size: sizeName }) : sizeName}</span>
          <Link href={studioHref} className="text-fg border-b border-current font-medium">
            {t("fullscreen")}
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2">
        <div className="pk-line-grid bg-bg relative grid h-60 place-items-center md:h-auto md:min-h-[420px]">
          {view === "3d" ? (
            <svg
              viewBox="-175 -150 350 300"
              className="h-auto max-h-full w-[94%] cursor-grab touch-pan-y select-none active:cursor-grabbing md:max-h-[390px]"
              role="img"
              aria-label={t("previewLabel", { shape: shapeName, size: sizeName })}
              tabIndex={0}
              onPointerDown={(event) => {
                drag.current = { x: event.clientX, yaw };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (drag.current) setYaw(drag.current.yaw - (event.clientX - drag.current.x) * DEG_PER_PX);
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  setYaw((value) => value + (event.key === "ArrowLeft" ? DEG_PER_KEY : -DEG_PER_KEY));
                }
              }}
            >
              <defs>
                <filter id={`${ids}-soft`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="8" />
                </filter>
              </defs>
              <ellipse {...box.shadow} fill="rgb(60 40 20 / 0.28)" filter={`url(#${ids}-soft)`} />
              {box.faces.map((face, index) => (
                <path key={index} d={face.d} fill={face.fill} />
              ))}
              <path d={box.seam} fill="none" stroke="rgb(70 45 20 / 0.5)" strokeWidth={1.4} />
              {box.logo ? (
                <>
                  <path d={box.logo.block} fill={box.logo.fill} />
                  <path d={box.logo.lines} fill="none" stroke={box.logo.fill} strokeWidth={1.2} />
                </>
              ) : null}
              <g fill="none" stroke="rgb(60 40 20 / 0.3)" strokeWidth={1}>
                {box.outlines.map((d, index) => (
                  <path key={index} d={d} />
                ))}
              </g>
            </svg>
          ) : current?.styleId ? (
            <HeroDieline
              styleId={current.styleId}
              size={size}
              corrugated={board?.id === "corrE"}
              label={t("dielineLabel", { shape: shapeName, size: sizeName })}
              fallback={t("dielineUnavailable")}
            />
          ) : (
            <p className="text-muted max-w-[18em] text-center text-[13px]">{t("dielineUnavailable")}</p>
          )}
          <div role="group" aria-label={t("view.label")} className="absolute start-3.5 top-3 flex gap-1.5">
            {(["3d", "flat"] as const).map((id) => (
              <Chip key={id} small pressed={view === id} onClick={() => setView(id)}>
                {t(`view.${id}`)}
              </Chip>
            ))}
          </div>
          {view === "3d" ? (
            <p aria-hidden="true" className="text-muted absolute end-3.5 bottom-3 text-[13px]">
              {t("view.rotate")}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col px-4.5 pt-3.5 pb-4.5">
          {current && selection ? (
            <>
              <Row label={t("labels.shape")} first>
                {SHAPES.filter((id) => shapes.some((shape) => shape.id === id)).map((id) => (
                  <Chip key={id} pressed={selection.shape === id} onClick={() => pick({ shape: id })}>
                    {t(`shapes.${id}`)}
                  </Chip>
                ))}
              </Row>
              <Row label={t("labels.size")}>
                {current.sizes.map((entry) => (
                  <Chip key={entry.id} pressed={size.id === entry.id} onClick={() => pick({ sizeId: entry.id })}>
                    {t("sizeChip", { w: cm(entry.lengthMm), d: cm(entry.widthMm), h: cm(entry.heightMm) })}
                  </Chip>
                ))}
                <Link href="/studio?custom=1" className="self-center border-b border-current text-[13px] font-medium">
                  {t("custom")}
                </Link>
              </Row>
              <Row label={t("labels.material")}>
                {BOARDS.map((id) => (
                  <Chip
                    key={id}
                    pressed={selection.material === id}
                    disabled={!current.materials.some((entry) => entry.id === id)}
                    onClick={() => pick({ material: id })}
                  >
                    {t(`boards.${id}`)}
                  </Chip>
                ))}
              </Row>
              <Row label={t("labels.print")}>
                {PRINTS.map((id) => (
                  <Chip
                    key={id}
                    pressed={selection.print === id}
                    disabled={!current.prints.some((entry) => entry.id === id)}
                    onClick={() => pick({ print: id })}
                  >
                    {t(`prints.${id}`)}
                  </Chip>
                ))}
              </Row>
              <Row label={t("labels.quantity")}>
                {current.qtys.map((value) => (
                  <Chip key={value} pressed={selection.qty === value} onClick={() => pick({ qty: value })}>
                    {format.number(value)}
                  </Chip>
                ))}
              </Row>
            </>
          ) : null}

          <div className="border-fg mt-auto border-t pt-4" aria-live="polite" aria-busy={pending || undefined}>
            <div className="flex flex-col items-start gap-3">
              <div className="min-h-[5.5rem] min-w-0">
                {!current || !selection ? (
                  <p className="text-muted max-w-[22em] text-sm">{t("noSetup")}</p>
                ) : priced ? (
                  <>
                    <p className="text-muted text-[13px]">
                      {t("priceCaption", { qty: format.number(shown!.selection.qty) })}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-[1.875rem] leading-tight font-semibold tracking-[-0.02em] tabular-nums transition-opacity",
                        pending && "opacity-60",
                      )}
                    >
                      {format.thb(priced.unitPrice)}{" "}
                      <small className="text-muted text-sm font-normal tracking-normal">
                        {t("total", { total: format.thb(priced.total) })}
                      </small>
                    </p>
                    <p className="text-muted text-[13px]">
                      {[
                        t("lead", {
                          days:
                            priced.leadTimeBusinessDays.min === priced.leadTimeBusinessDays.max
                              ? format.number(priced.leadTimeBusinessDays.min)
                              : `${format.number(priced.leadTimeBusinessDays.min)}–${format.number(priced.leadTimeBusinessDays.max)}`,
                        }),
                        t("lock", { date: format.date(priced.priceLockUntil) }),
                      ].join(" · ")}
                    </p>
                  </>
                ) : preview.isError ? (
                  <p className="text-muted max-w-[22em] text-sm">
                    {/* A 4xx: the API cannot price this choice instantly; a failure may pass on a retry. */}
                    {isApiError(preview.error) && preview.error.status < 500 ? t("unpriced") : t("retry")}
                  </p>
                ) : (
                  <p className="text-muted text-sm">{t("calculating")}</p>
                )}
              </div>
              <Link href={studioHref} className={buttonVariants({ size: "md", className: "whitespace-nowrap" })}>
                {t("continue")}
              </Link>
            </div>
            {/* Always takes its line, so the panel does not grow when the price arrives (CLS). */}
            {configureHref && priced ? (
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
  small = false,
  title,
  onClick,
  children,
}: {
  pressed: boolean;
  disabled?: boolean;
  /** The view switch over the drawing: a step smaller than the option chips. */
  small?: boolean;
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
        // A preset label is at most 14 characters (home.test.ts), so a chip never outgrows the panel.
        "rounded-control bg-surface inline-flex max-w-full items-center truncate border px-2.5 whitespace-nowrap",
        small ? "h-7 text-xs" : "h-8 text-[13px]",
        "focus-visible:ring-focus-ring duration-fast transition-colors outline-none focus-visible:ring-2",
        "disabled:cursor-not-allowed disabled:opacity-45",
        pressed ? "border-fg text-fg font-semibold" : "border-border text-muted hover:border-subtle",
      )}
    >
      {children}
    </button>
  );
}
