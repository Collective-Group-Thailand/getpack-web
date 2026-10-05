import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { NextStep } from "@/features/customer/shell/NextStep";
import { getSampleKits } from "@/features/customer/catalog/api.server";
import { SampleKitForm } from "@/features/customer/help/SampleKitForm";
import { getFormat } from "@/features/shared/format/server";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help.samples");
  return { title: t("title"), description: t("intro") };
}

/** Sample kits (F3 3.7): what is in each, then where to send one. */
export default async function Page() {
  const [t, format, kits] = await Promise.all([getTranslations("help.samples"), getFormat(), getSampleKits()]);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted mt-2">{t("intro")}</p>
      </header>
      {kits.length === 0 ? (
        <EmptyState icon="package" title={t("noneTitle")} description={t("noneBody")} action={<NextStep to="chat" />} />
      ) : (
        <>
          <ul className="grid gap-4 md:grid-cols-2">
            {kits.map((kit) => (
              <li key={kit.code} className="border-border rounded-xl border p-5">
                <h2 className="text-lg font-semibold">{kit.name}</h2>
                <p className="text-primary mt-1 font-medium">
                  {kit.price === "0.00" ? t("free") : format.thb(kit.price)}
                  {kit.creditedOnFirstOrder ? (
                    <span className="text-muted ms-2 text-sm font-normal">{t("creditedShort")}</span>
                  ) : null}
                </p>
                <p className="text-muted mt-2 text-sm">{kit.description}</p>
                <ul className="mt-3 list-disc ps-5 text-sm">
                  {kit.contents.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <section aria-labelledby="samples-form" className="max-w-3xl">
            <h2 id="samples-form" className="mb-4 text-lg font-semibold">
              {t("formTitle")}
            </h2>
            <SampleKitForm kits={kits} />
          </section>
        </>
      )}
    </div>
  );
}
