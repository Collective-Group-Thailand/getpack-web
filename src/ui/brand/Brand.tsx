import Link from "next/link";
import { BRAND_HEX, BRAND_NAME } from "./config";

/**
 * Packio's own mark: a P whose bowl carries a crease line, drawn for this repo.
 * No third-party logo or template is used anywhere in src/ui.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill={BRAND_HEX} />
      <g fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11.5 24V8h6a4.5 4.5 0 0 1 0 9h-6" />
        <path d="M11.5 12.5h6" opacity="0.45" />
      </g>
    </svg>
  );
}

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold tracking-tight">
      <BrandMark />
      <span>{BRAND_NAME}</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Brand />
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/account/designs" className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100">
            แบบของฉัน
          </Link>
          <Link
            href="/design/new"
            className="rounded-lg bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700"
          >
            เริ่มออกแบบ
          </Link>
        </nav>
      </div>
    </header>
  );
}
