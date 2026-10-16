import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Brand } from "@/ui/brand";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { OpenBoxIllustration } from "@/ui/components/ProductIllustration";

/** A real miss outside the signed-in shell. Cross-zone probes never get here — `src/proxy.ts`
 * answers those with a bare 404 before any app code runs. The brand and a way home, so the page
 * is not a dead end (UX audit: the admin 404 had no logo). */
export default async function NotFoundPage() {
  const t = await getTranslations("common.errors");

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-4 py-16">
      <Brand href="/" height={40} className="flex self-center" />
      <EmptyState
        className="border-none"
        titleAs="h1"
        illustration={<OpenBoxIllustration />}
        title={t("notFoundTitle")}
        description={t("notFoundBody")}
        action={
          <Button asChild>
            <Link href="/">{t("backHome")}</Link>
          </Button>
        }
      />
    </main>
  );
}
