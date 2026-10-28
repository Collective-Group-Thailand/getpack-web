"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { useDebounced } from "@/features/customer/configurator/pricing";
import { isoBox, isoFaceMatrix, MATERIAL_TINT } from "@/features/customer/home/iso-box";
import {
  openingOf,
  requestOf,
  sameSelection,
  type HeroPriced,
  type HeroSelection,
} from "@/features/customer/home/studio-hero";
import type { HeroShape } from "@/features/customer/home/studio-hero.server";
import { giveHandoff } from "@/features/designer/handoff";
import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { trackStudioHub } from "@/lib/analytics";
import { browserApi, isApiError } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import { buttonVariants } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { studioHref } from "../paths";

// The flat sheet needs the dieline engine: it loads after the page, never in the way of the hero's first paint.
const MiniFlat = dynamic(() => import("./MiniFlat"), { ssr: false });

/** PNG, JPG, SVG or WEBP up to 5 MB (studio redesign Phase 1 item 2). */
const LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const LOGO_MAX_BYTES = 5 * 1024 * 1024;
/** The price follows a pause in the customer's choices (as the home hero). */
const PRICE_DELAY_MS = 250;
/** The ink a mark is drawn in: one spot colour (black) or full colour (getpack green, a CMYK-only colour). */
const INK = { none: "rgb(40 30 20 / 0.28)", one: "#1f2421", full: "#0f5f4e" } as const;
/** Swatch faces for the print choices (a name always goes with each — `aria-label`). */
const SWATCH = { none: "#d9c6a5", one: "#1f2421", full: "#0f5f4e" } as const;

/**
 * The Studio front door's mini editor (studio redesign Phase 1 item 2): a logo (button or drop on the editor) or a
 * brand name set on the box's top and front faces and on its flat sheet; the sizes and prints of the hero presets
 * (D-310, admin-mapped — never constants here) with the price `store.quotes.preview` gives the selection (the
 * configurator's path; nothing is computed here). The logo stays in the browser; "เปิดในสตูดิโอ" hands the brand
 * name or logo, the size and the print to the editor (`giveHandoff`). The first frame is the server's (a static
 * isometric box and the opening price), so it never holds back the page's first paint.
 */
export function HeroMiniEditor({ shape, initial }: { shape: HeroShape | null; initial: HeroPriced | null }) {
  const t = useTranslations("studio.home.mini");
  const tPanel = useTranslations("home.panel");
  const format = useFormat();
  const ids = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [brand, setBrand] = useState("");
  const [logo, setLogo] = useState<{ src: string; name: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selection, setSelection] = useState<HeroSelection | null>(
    initial?.selection.shape === shape?.id ? initial!.selection : shape ? openingOf(shape) : null,
  );
  const settled = useDebounced(selection, PRICE_DELAY_MS);
  const fresh = settled !== null && initial !== null && sameSelection(settled, initial.selection);
  const body = settled && shape ? requestOf(settled, [shape]) : null;
  const preview = useQuery({
    queryKey: [...queryKeys.zone("customer"), "studio-hub-preview", body],
    queryFn: async (): Promise<HeroPriced> => {
      const { data } = await browserApi().POST("/v1/store/quotes/actions/preview", { body: body! });
      return { selection: settled!, preview: data! };
    },
    enabled: body !== null && !fresh,
    initialData: fresh ? initial! : undefined,
    placeholderData: (previous) => previous,
    staleTime: 60_000,
    retry: 1,
  });
  const pending = selection !== settled || preview.isFetching;
  const priced = preview.data && settled && sameSelection(preview.data.selection, settled) ? preview.data : null;

  const size = shape?.sizes.find((entry) => entry.id === selection?.sizeId) ?? shape?.sizes[0] ?? null;
  const print = selection?.print ?? "one";
  const board = shape?.materials.find((entry) => entry.id === selection?.material) ?? null;
  const cm = (mm: number) => format.number(mm / 10, { maximumFractionDigits: 1 });
  const sizeName = size ? tPanel("sizeChip", { w: cm(size.lengthMm), d: cm(size.widthMm), h: cm(size.heightMm) }) : "";
  const shapeName = shape ? tPanel(`shapes.${shape.id}`) : tPanel("box");
  const dims = size ? { w: size.lengthMm, d: size.widthMm, h: size.heightMm } : { w: 300, d: 200, h: 110 };
  const box = isoBox(dims, shape?.id ?? "mailer", MATERIAL_TINT[board?.id ?? "kraft350"], "none");
  const text = brand.trim();

  const take = (file: File | undefined) => {
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return void toast.error(t("wrongType"));
    if (file.size > LOGO_MAX_BYTES) return void toast.error(t("tooLarge"));
    const reader = new FileReader();
    reader.onload = () => {
      setLogo({ src: reader.result as string, name: file.name });
      trackStudioHub("studio_hero_interact", { field: "logo" });
      toast.success(t("placed"));
    };
    reader.readAsDataURL(file);
  };
  const pick = (next: Partial<HeroSelection>, field: "size" | "colour") => {
    setSelection((prev) => (prev ? { ...prev, ...next } : prev));
    trackStudioHub("studio_hero_interact", { field });
  };

  const openHref = shape
    ? studioHref({
        product: shape.productSlug,
        pattern: shape.patternId,
        material: board?.materialId ?? null,
        ...(shape.styleId && size
          ? { style: shape.styleId, dims: { l: size.lengthMm, w: size.widthMm, h: size.heightMm } }
          : {}),
        step: shape.styleId && size ? "design" : "start",
      })
    : "/styles";
  const mark = logo ? t("markLogo") : text ? t("markBrand", { brand: text }) : t("markNone");

  /** The mark on one face: the logo fitted into the middle of it, or the brand name in the print's ink. */
  const onFace = (face: "top" | "front") => {
    const [u, v] = face === "top" ? [dims.w, dims.d] : [dims.w, dims.h];
    const [fw, fh] = [u * 0.56, v * (face === "top" ? 0.5 : 0.46)];
    return (
      <g transform={isoFaceMatrix(dims, face)}>
        {logo ? (
          <image
            href={logo.src}
            x={(u - fw) / 2}
            y={(v - fh) / 2}
            width={fw}
            height={fh}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : (
          <text
            x={u / 2}
            y={v / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill={INK[print]}
            fontWeight={700}
            fontSize={Math.min(fh * 0.62, (fw / Math.max(4, (text || t("brandPlaceholder")).length)) * 1.7)}
            opacity={text ? 1 : 0.35}
          >
            {text || t("brandPlaceholder")}
          </text>
        )}
      </g>
    );
  };

  return (
    <div
      aria-label={t("label")}
      role="group"
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        take(event.dataTransfer.files[0]);
      }}
      className={cn(
        "border-border bg-surface rounded-panel shadow-panel relative overflow-hidden border",
        dragging && "ring-primary ring-2 ring-offset-0",
      )}
    >
      <div className="border-border text-muted flex items-center gap-2.5 border-b px-3.5 py-2.5 text-[12.5px]">
        <span aria-hidden="true" className="flex gap-1.5">
          {[0, 1, 2].map((dot) => (
            <i key={dot} className="bg-border size-2 rounded-full" />
          ))}
        </span>
        <b className="text-fg ms-1.5 truncate font-medium">
          {shape && size ? tPanel("summary", { shape: shapeName, size: sizeName }) : shapeName}
        </b>
        <span className="text-primary ms-auto inline-flex items-center gap-1.5 text-[11.5px] font-medium">
          <i aria-hidden="true" className="bg-primary size-1.5 rounded-full" />
          {t("live")}
        </span>
      </div>

      <div className="grid sm:grid-cols-[2.75rem_minmax(0,1fr)_13rem]">
        <div
          aria-hidden="true"
          className="border-border hidden flex-col items-center gap-1.5 border-e px-1.5 py-2.5 sm:flex"
        >
          {(["text", "image", "box", "ruler"] as const).map((name, index) => (
            <span
              key={name}
              className={cn(
                "rounded-control grid size-8 place-items-center",
                index === 0 ? "bg-bg-subtle text-primary" : "text-muted",
              )}
            >
              <Icon name={name} size={18} />
            </span>
          ))}
        </div>

        <div className="pk-line-grid bg-bg relative grid min-h-[300px] place-items-center p-4 sm:min-h-[330px]">
          {dragging ? (
            <p className="text-primary absolute inset-x-0 top-3 text-center text-sm font-semibold">{t("dropHere")}</p>
          ) : null}
          <svg
            viewBox="-175 -150 350 300"
            className="h-auto w-[82%] max-w-[420px]"
            role="img"
            aria-label={t("preview", { shape: shapeName, size: sizeName, mark })}
          >
            <ellipse {...box.shadow} fill="rgb(0 0 0 / 0.22)" />
            {box.faces.map((face, index) => (
              <path key={index} d={face.d} fill={face.fill} />
            ))}
            <path d={box.seam} fill="none" stroke="rgb(70 45 20 / 0.5)" strokeWidth={1.4} />
            {print !== "none" || !logo ? onFace("top") : null}
            {print !== "none" || !logo ? onFace("front") : null}
            <g fill="none" stroke="rgb(60 40 20 / 0.3)" strokeWidth={1}>
              {box.outlines.map((d, index) => (
                <path key={index} d={d} />
              ))}
            </g>
          </svg>
          <div className="border-border bg-surface rounded-card w-[9.5rem] justify-self-start border p-1.5 sm:absolute sm:start-3 sm:bottom-3">
            <small className="text-muted ms-0.5 mb-1 block text-[10.5px]">{t("flat")}</small>
            <div className="relative aspect-[8/5]">
              {shape?.styleId && size ? (
                <MiniFlat
                  styleId={shape.styleId}
                  size={size}
                  corrugated={board?.id === "corrE"}
                  label={tPanel("dielineLabel", { shape: shapeName, size: sizeName })}
                />
              ) : null}
              <span className="absolute inset-0 grid place-items-center">
                {logo ? (
                  // A data URL from the customer's own file: next/image cannot optimise it.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo.src} alt="" className="max-h-[38%] max-w-[38%] object-contain" />
                ) : (
                  <span
                    className="max-w-[60%] truncate text-[11px] font-bold"
                    style={{ color: INK[print], opacity: text ? 1 : 0.4 }}
                  >
                    {text || t("brandPlaceholder")}
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="border-border flex flex-col gap-3.5 border-t p-3.5 sm:border-s sm:border-t-0">
          <div>
            <span className="text-muted mb-1.5 block text-[11.5px] font-medium">{t("logo")}</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-control border-primary text-primary bg-primary-subtle focus-visible:ring-focus-ring inline-flex h-9.5 min-w-0 flex-1 items-center justify-center gap-1.5 border border-dashed px-2 text-[13px] font-semibold outline-none focus-visible:ring-2"
              >
                <Icon name="upload" size={16} aria-hidden="true" />
                <span className="truncate">{logo ? logo.name : t("useLogo")}</span>
              </button>
              {logo ? (
                <button
                  type="button"
                  aria-label={t("removeLogo")}
                  onClick={() => setLogo(null)}
                  className="rounded-control border-border text-muted hover:text-fg focus-visible:ring-focus-ring grid size-9.5 place-items-center border outline-none focus-visible:ring-2"
                >
                  <Icon name="close" size={14} aria-hidden="true" />
                </button>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept={LOGO_TYPES.join(",")}
                hidden
                onChange={(event) => {
                  take(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>
            <small className="text-muted mt-1.5 block text-[10.5px] leading-snug">{t("logoNote")}</small>
          </div>

          <div>
            <label htmlFor={`${ids}-brand`} className="text-muted mb-1.5 block text-[11.5px] font-medium">
              {t("brand")}
            </label>
            <input
              id={`${ids}-brand`}
              value={brand}
              maxLength={24}
              disabled={logo !== null}
              placeholder={t("brandPlaceholder")}
              onChange={(event) => setBrand(event.target.value)}
              onBlur={() => (brand ? trackStudioHub("studio_hero_interact", { field: "brand" }) : undefined)}
              className="rounded-control border-border bg-bg-subtle text-fg focus-visible:border-primary h-9 w-full border px-2.5 text-sm font-semibold outline-none disabled:opacity-50"
            />
          </div>

          {shape && selection ? (
            <>
              <div role="group" aria-label={t("size")}>
                <span aria-hidden="true" className="text-muted mb-1.5 block text-[11.5px] font-medium">
                  {t("size")}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {shape.sizes.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      aria-pressed={selection.sizeId === entry.id}
                      onClick={() => pick({ sizeId: entry.id }, "size")}
                      className={cn(
                        "rounded-control focus-visible:ring-focus-ring h-7.5 border px-2 text-[12px] font-semibold tabular-nums outline-none focus-visible:ring-2",
                        selection.sizeId === entry.id
                          ? "border-primary text-primary bg-primary-subtle"
                          : "border-border text-muted hover:text-fg",
                      )}
                    >
                      {tPanel("sizeChip", { w: cm(entry.lengthMm), d: cm(entry.widthMm), h: cm(entry.heightMm) })}
                    </button>
                  ))}
                </div>
              </div>

              <div role="group" aria-label={t("print")}>
                <span aria-hidden="true" className="text-muted mb-1.5 block text-[11.5px] font-medium">
                  {t("print")}
                </span>
                <div className="flex gap-2">
                  {shape.prints.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      aria-pressed={selection.print === entry.id}
                      aria-label={t(`prints.${entry.id}`)}
                      title={t(`prints.${entry.id}`)}
                      onClick={() => pick({ print: entry.id }, "colour")}
                      style={{ background: SWATCH[entry.id] }}
                      className={cn(
                        "focus-visible:ring-focus-ring size-7 rounded-full border-2 outline-none focus-visible:ring-2",
                        selection.print === entry.id ? "border-primary" : "border-border",
                      )}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : null}

          <div className="border-border mt-auto border-t pt-3" aria-live="polite" aria-busy={pending || undefined}>
            {!shape || !selection ? (
              <p className="text-muted text-[12.5px]">{t("noPresets")}</p>
            ) : priced ? (
              <>
                <b
                  className={cn(
                    "block text-[1.625rem] leading-tight font-bold tracking-[-0.01em] tabular-nums transition-opacity",
                    pending && "opacity-60",
                  )}
                >
                  {format.thb(priced.preview.unitPrice)}
                </b>
                <small className="text-muted text-[11.5px]">
                  {tPanel("priceCaption", { qty: format.number(priced.selection.qty) })}
                </small>
              </>
            ) : preview.isError ? (
              <p className="text-primary text-[12.5px]">
                {isApiError(preview.error) && preview.error.status < 500 ? t("unpricedColour") : tPanel("retry")}
              </p>
            ) : (
              <p className="text-muted text-[12.5px]">{tPanel("calculating")}</p>
            )}
            <Link
              href={openHref}
              onClick={() => {
                giveHandoff({ brand: text || null, logo, print });
                trackStudioHub("studio_hero_open_editor", {});
              }}
              className={buttonVariants({ size: "sm", block: true, className: "mt-3" })}
            >
              {t("open")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
