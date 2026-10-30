import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LiffNav } from "@/features/customer/liff/LiffNav";
import { Link } from "@/i18n/navigation";
import { BRAND_NAME } from "@/ui/brand";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * LINE LIFF (D-151): the storefront's own pages in a frame for LINE's in-app browser — a slim
 * top bar, the content, and four tabs at the bottom. No site header or footer, no marketing tags.
 */
export default async function LiffLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("liff");
  return (
    <div className="bg-bg flex min-h-dvh flex-col">
      <a href="#liff-main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50">
        {t("skip")}
      </a>
      {/* Project D: a slim bar under LINE's own title bar — the brand and where you are, nothing to tap but home. */}
      <header className="border-border bg-surface sticky top-0 z-30 border-b pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-11 max-w-xl items-center gap-2 px-4">
          <Link
            href="/liff"
            className="focus-visible:ring-focus-ring rounded-control -ms-1 inline-flex min-h-11 items-center px-1 font-sans text-[1.0625rem] font-semibold outline-none focus-visible:ring-2"
          >
            {BRAND_NAME}
          </Link>
          <span className="bg-primary-subtle text-primary-subtle-fg rounded-control px-2 py-0.5 text-xs font-medium">
            {t("tagline")}
          </span>
        </div>
      </header>
      <main id="liff-main" className="mx-auto w-full max-w-xl flex-1 px-4 pt-4 pb-[calc(var(--mobile-tab-h)+1.5rem)]">
        {children}
      </main>
      <LiffNav />
    </div>
  );
}
