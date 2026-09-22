import Link from "next/link";

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0f766e" />
      <path d="M16 6 26 11v10l-10 5-10-5V11z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 11l10 5 10-5M16 16v10" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold tracking-tight">
      <BrandMark />
      <span>
        Box<span className="text-teal-600">Studio</span>
      </span>
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
