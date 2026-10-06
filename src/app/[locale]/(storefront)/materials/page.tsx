import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { listMaterials } from "@/features/customer/learn/api.server";
import { MaterialsLibrary } from "@/features/customer/learn/MaterialsLibrary";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help.materials");
  return { title: t("title"), description: t("intro") };
}

/** The materials library (U5.6 §1). */
export default async function Page() {
  const [t, materials] = await Promise.all([getTranslations("help.materials"), listMaterials()]);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-[2rem] leading-tight">{t("title")}</h1>
        <p className="text-muted mt-2 max-w-prose">{t("intro")}</p>
      </header>
      {materials.length === 0 ? (
        <EmptyState
          icon="layers"
          title={t("empty.title")}
          description={t("empty.body")}
          action={
            <Button asChild>
              <Link href="/samples">{t("empty.action")}</Link>
            </Button>
          }
        />
      ) : (
        <MaterialsLibrary materials={materials} />
      )}
    </div>
  );
}
