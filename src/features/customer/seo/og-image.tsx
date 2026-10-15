import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { BRAND_COMPANY, BRAND_NAME } from "@/ui/brand";

export const OG_SIZE = { width: 1200, height: 630 } as const;

/**
 * Anuphan as static TTFs at 400 and 700 with Thai and Latin in one file, for satori (which reads
 * neither woff2 nor a variable font's axes). Cut from the site's own files (fonts/README.md), so
 * the card is set in the site's face.
 */
async function fonts() {
  const dir = join(process.cwd(), "src/features/customer/seo/fonts");
  const [bold, regular] = await Promise.all(["anuphan-700.ttf", "anuphan-400.ttf"].map((name) => readFile(join(dir, name))));
  return [
    { name: "Anuphan", data: bold!, weight: 700 as const, style: "normal" as const },
    { name: "Anuphan", data: regular!, weight: 400 as const, style: "normal" as const },
  ];
}

export interface OgCard {
  /** The page's own title — at most two lines at 64 px. */
  title: string;
  /** A line under it: the page's answer, a price, a category. */
  subtitle?: string | null;
  /** A small label above the title: the section the page is in ("สินค้า", "ช่วยเหลือ"). */
  eyebrow?: string | null;
}

/*
 * The card's colours are the light theme's own values (primitives.ts: paper, ink, primary),
 * written out because an image has no CSS variables to read. They change with the brand kit
 * like the tokens do (docs/ui/brand.md).
 */
const INK = "#1A1D21";
const MUTED = "#4F5660";
const PAPER = "#F3F4F6";
const SURFACE = "#FFFFFF";
const PRIMARY = "#0F5F4E";
const KRAFT = "#DCCDB3";

/**
 * The Open Graph card every storefront page shares: the brand, the page's title and one line
 * under it, on the paper page with a kraft box corner — 1200×630, the size every network scales
 * from. A page with nothing to say gets the brand and tagline alone.
 */
export async function renderOgCard(card: OgCard): Promise<ImageResponse> {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: PAPER,
          color: INK,
          fontFamily: "Anuphan",
          position: "relative",
        }}
      >
        {/* A box, drawn as three faces, in the corner — the product, not a photo of one. */}
        <div
          style={{
            position: "absolute",
            right: -70,
            bottom: -80,
            width: 400,
            height: 400,
            display: "flex",
            transform: "rotate(-8deg)",
          }}
        >
          <div style={{ position: "absolute", left: 40, top: 110, width: 300, height: 240, background: KRAFT, borderRadius: 16 }} />
          <div style={{ position: "absolute", left: 40, top: 60, width: 300, height: 60, background: "#C8A97B", borderRadius: 12 }} />
          <div style={{ position: "absolute", left: 60, top: 150, width: 130, height: 18, background: PRIMARY, borderRadius: 9, opacity: 0.85 }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: PRIMARY,
              color: SURFACE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            {BRAND_NAME.charAt(0)}
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>{BRAND_NAME}</div>
          {card.eyebrow ? (
            <div
              style={{
                marginLeft: 12,
                padding: "6px 16px",
                borderRadius: 999,
                background: SURFACE,
                color: MUTED,
                fontSize: 24,
                fontWeight: 400,
              }}
            >
              {card.eyebrow}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 740 }}>
          <div style={{ fontSize: card.title.length > 40 ? 54 : 64, fontWeight: 700, lineHeight: 1.15, letterSpacing: -1.5 }}>
            {card.title}
          </div>
          {card.subtitle ? (
            <div style={{ fontSize: 30, fontWeight: 400, color: MUTED, lineHeight: 1.4 }}>{card.subtitle}</div>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 24, color: MUTED }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: PRIMARY }} />
          <div>{BRAND_COMPANY}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
}
