import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { GuidedHelp } from "@/features/customer/help/GuidedHelp";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help.guided");
  return { title: t("title"), description: t("intro") };
}

/** Guided help as a page (F3 3.7): the widget's questions and hand-off, for a direct link. */
export default async function Page() {
  const t = await getTranslations("help.guided");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted mt-2">{t("intro")}</p>
      </header>
      <GuidedHelp />
    </div>
  );
}
