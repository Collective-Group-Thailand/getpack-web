import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { listGlossary } from "@/features/customer/learn/api.server";
import { GlossaryList } from "@/features/customer/learn/GlossaryList";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help.glossary");
  return { title: t("title"), description: t("intro") };
}

/** Packaging words in plain Thai and English (U5.6, U5.2 §3) — where every chip and check links. */
export default async function Page() {
  const [t, terms] = await Promise.all([getTranslations("help.glossary"), listGlossary()]);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-[2rem] leading-tight">{t("title")}</h1>
        <p className="text-muted mt-2">{t("intro")}</p>
      </header>
      <GlossaryList terms={terms} />
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link href="/learn">{t("learn")}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/help/chat">{t("ask")}</Link>
        </Button>
      </div>
    </div>
  );
}
