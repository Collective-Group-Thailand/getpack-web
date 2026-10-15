import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { pick } from "@/features/customer/catalog/localize";
import { listLearningPaths } from "@/features/customer/learn/api.server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help.learn");
  return { title: t("title"), description: t("intro") };
}

/** Buyer learning paths (U5.6 §2): a few articles in order, each path ending in a pre-filled action. */
export default async function Page() {
  const [t, locale, paths] = await Promise.all([getTranslations("help.learn"), getLocale(), listLearningPaths()]);
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-10 md:px-8 md:py-14">
      <header>
        <h1 className="text-4xl leading-tight md:text-5xl">{t("title")}</h1>
        <p className="text-muted mt-3 max-w-prose text-lg">{t("intro")}</p>
      </header>
      {paths.length === 0 ? (
        <EmptyState
          icon="article"
          title={t("empty.title")}
          description={t("empty.body")}
          action={
            <Button asChild>
              <Link href="/articles">{t("empty.action")}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {paths.map((path) => (
            <li key={path.slug}>
              <Link
                href={`/learn/${path.slug}`}
                className="bg-surface border-border hover:border-primary flex h-full flex-col gap-2 rounded-xl border p-5 transition"
              >
                <Icon name="article" size={20} className="text-primary" />
                <span className="text-lg font-semibold">{pick(locale, path.titleTh, path.titleEn)}</span>
                <span className="text-muted text-sm">{pick(locale, path.summaryTh, path.summaryEn)}</span>
                <span className="text-muted mt-auto text-xs">{t("steps", { count: path.steps.length })}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
