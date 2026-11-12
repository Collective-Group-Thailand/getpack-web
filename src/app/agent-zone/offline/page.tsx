import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import Link from "next/link";

import { BrandLogo } from "@/ui/brand";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agentZone.offline");
  return { title: t("title") };
}

/**
 * getpack Agent's offline shell (D-467): what the service worker shows when a page cannot load. It needs no data
 * and no JavaScript — the "try again" is a plain link — so the cached copy works on its own.
 */
export default async function OfflinePage() {
  const t = await getTranslations("agentZone.offline");
  return (
    <main id="main" className="bg-bg flex min-h-dvh flex-col items-center justify-center gap-8 px-5 py-12 text-center">
      <BrandLogo height={28} />
      <div className="border-border bg-surface rounded-panel shadow-card flex w-full max-w-md flex-col items-center gap-3 border p-6 sm:p-8">
        <span className="bg-bg-subtle text-muted grid size-12 place-items-center rounded-full">
          <Icon name="refresh" size={22} aria-hidden="true" />
        </span>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-muted">{t("body")}</p>
        <Button asChild className="mt-2">
          <Link href="/" prefetch={false}>
            {t("retry")}
          </Link>
        </Button>
      </div>
    </main>
  );
}
