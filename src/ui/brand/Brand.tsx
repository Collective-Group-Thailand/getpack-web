import Link from "next/link";

import { BRAND_NAME } from "./config";

/**
 * Packio's own mark: a P whose bowl carries a crease line, drawn for this repo. No
 * third-party logo, template or asset appears anywhere in src/ui (CLAUDE.md).
 *
 * The fill is the semantic `primary` token, so the mark follows the theme and a brand-hue
 * change reaches it without an edit here (docs/ui/brand.md).
 */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <g fill="none" className="stroke-primary-fg" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11.5 24V8h6a4.5 4.5 0 0 1 0 9h-6" />
        <path d="M11.5 12.5h6" opacity="0.45" />
      </g>
    </svg>
  );
}

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`font-sans flex items-center gap-2 font-semibold tracking-tight ${className ?? ""}`}
    >
      <BrandMark />
      <span>{BRAND_NAME}</span>
    </Link>
  );
}
