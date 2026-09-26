import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TrackForm } from "@/features/customer/fulfilment/TrackForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("fulfilment.track");
  return { title: t("title"), description: t("intro") };
}

/** Tracking by the code on the carton label or in a shared link (F3 3.6). */
export default async function Page() {
  const t = await getTranslations("fulfilment.track");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted">{t("intro")}</p>
      <TrackForm />
    </div>
  );
}
