import Link from "next/link";

import { BRAND_NAME } from "./config";

/**
 * getpack's logo: the wordmark on a green oval (`public/brand/getpack-logo.png`, supplied by the
 * product owner 2026-10-16, white background removed). Its green is `primary-600` (#0F5F4E) and its
 * letters `paper-50` (#F6F3EE), so it sits on the light page, white cards and the dark theme alike.
 *
 * Raster for now: shown at most 48 px high, the 240 px source covers 3× screens. When the brand
 * kit brings the vector file, swap `LOGO.src` for the SVG — the box below stays the same.
 */
export const LOGO = { src: "/brand/getpack-logo.png", width: 478, height: 240 } as const;

export function BrandLogo({
  height = 32,
  priority = false,
  className,
}: {
  /** Rendered height in CSS pixels; the width follows the logo's 2:1 oval. */
  height?: number;
  /** For the header that is in view on load (LCP). */
  priority?: boolean;
  className?: string;
}) {
  const width = Math.round((height * LOGO.width) / LOGO.height);
  return (
    // A plain <img>: the app serves its own static images as files (no next/image optimiser; the
    // proxy passes `/brand/getpack-logo.png` through on every host), and the file is 33 kB.
    // eslint-disable-next-line @next/next/no-img-element -- see above
    <img
      src={LOGO.src}
      alt={BRAND_NAME}
      width={width}
      height={height}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      loading={priority ? "eager" : "lazy"}
      draggable={false}
      className={`shrink-0 select-none ${className ?? ""}`}
    />
  );
}

/** The logo as the link home: its accessible name is the logo's alt text, the brand name. */
export function Brand({
  href = "/",
  height = 32,
  priority = false,
  className,
}: {
  href?: string;
  height?: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={`flex shrink-0 items-center ${className ?? ""}`}>
      <BrandLogo height={height} priority={priority} />
    </Link>
  );
}
