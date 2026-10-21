import Link from "next/link";

import { BRAND_NAME } from "./config";
import {
  LOGO_COLORS,
  LOGO_DOT,
  LOGO_G_PATH,
  LOGO_INK_PATH,
  LOGO_NOTCH_PATH,
  LOGO_TRACE_TRANSFORM,
  LOGO_VIEWBOX,
} from "./logo-paths";

/**
 * getpack's logo: the "getpack." wordmark (supplied by the product owner 2026-10-21) — dark letters, a
 * dark-green "g" with a bright-green corner notch, and a green full stop. Vector data in `logo-paths.ts`.
 *
 * Inline SVG rather than an image file, so the letters can follow the theme: on the light and
 * high-contrast pages they are the supplied near-black and dark green; on the dark theme both turn to
 * the page's foreground (`.brand-logo` in `base.css`), because #262626 and #0B3F2F vanish on a dark
 * page. The notch and the full stop keep their greens everywhere — they are what makes the mark.
 *
 * `tone="mono"` is the one-colour logo for a coloured surface (the sign-in panel, the designer's toolbar):
 * every part, the notch and the full stop too, takes the surrounding text colour — the greens would sink
 * into a green or grey panel.
 *
 * `LOGO` is the box (`width` : `height` = 302 : 71, about 4.25 : 1); `public/brand/getpack-logo.svg`
 * and `.png` are the same logo as files, for anything outside the app (emails, documents).
 */
export const LOGO = {
  src: "/brand/getpack-logo.svg",
  width: LOGO_VIEWBOX.width,
  height: LOGO_VIEWBOX.height,
} as const;

const VIEWBOX = `${LOGO_VIEWBOX.x} ${LOGO_VIEWBOX.y} ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`;

export function BrandLogo({
  height = 24,
  tone = "brand",
  className,
}: {
  /** Rendered height in CSS pixels (the letters' full height, ascender to descender); the width follows. */
  height?: number;
  /** `brand`: the supplied colours, following the theme. `mono`: all in the surrounding text colour. */
  tone?: "brand" | "mono";
  className?: string;
}) {
  const width = Math.round((height * LOGO.width) / LOGO.height);
  const mono = tone === "mono";
  const ink = mono ? "currentColor" : `var(--logo-ink, ${LOGO_COLORS.ink})`;
  const g = mono ? "currentColor" : `var(--logo-g, ${LOGO_COLORS.g})`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={VIEWBOX}
      width={width}
      height={height}
      role="img"
      aria-label={BRAND_NAME}
      focusable="false"
      className={`brand-logo shrink-0 select-none ${className ?? ""}`}
    >
      <g transform={LOGO_TRACE_TRANSFORM}>
        <path fill={ink} d={LOGO_INK_PATH} />
        <path fill={g} d={LOGO_G_PATH} />
      </g>
      <path fill={mono ? "currentColor" : LOGO_COLORS.notch} d={LOGO_NOTCH_PATH} />
      <circle fill={mono ? "currentColor" : LOGO_COLORS.dot} cx={LOGO_DOT.cx} cy={LOGO_DOT.cy} r={LOGO_DOT.r} />
    </svg>
  );
}

/** The logo as the link home: its accessible name is the logo's label, the brand name. */
export function Brand({ href = "/", height = 24, className }: { href?: string; height?: number; className?: string }) {
  return (
    // `className` may set the display (`hidden lg:flex`), so the default `flex` is only a default.
    <Link href={href} className={`shrink-0 items-center ${className ?? "flex"}`}>
      <BrandLogo height={height} />
    </Link>
  );
}
