import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { pick } from "@/features/customer/catalog/localize";
import { actionHref, listLearningPaths } from "@/features/customer/learn/api.server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";

type Props = { params: Promise<{ slug: string }> };

async function pathOf(slug: string) {
  return (await listLearningPaths()).find((path) => path.slug === slug) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const path = await pathOf(slug);
  return path
    ? { title: pick(locale, path.titleTh, path.titleEn), description: pick(locale, path.summaryTh, path.summaryEn) }
    : {};
}

/** One learning path (U5.6 §2): its articles in order, then the action it prepares for, pre-filled. */
export default async function Page({ params }: Props) {
  const [{ slug }, t, locale] = await Promise.all([params, getTranslations("help.learn"), getLocale()]);
  const path = await pathOf(slug);
  if (!path) notFound();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/learn" className="text-primary text-sm underline-offset-4 hover:underline">
        {t("back")}
      </Link>
      <header>
        <h1 className="text-[2rem] leading-tight">{pick(locale, path.titleTh, path.titleEn)}</h1>
        <p className="text-muted mt-2">{pick(locale, path.summaryTh, path.summaryEn)}</p>
      </header>
      <ol className="flex flex-col gap-3">
        {path.steps.map((step, index) => (
          <li key={step.articleSlug}>
            <Link
              href={`/articles/${step.articleSlug}`}
              className="border-border hover:border-primary flex items-center gap-4 rounded-xl border p-4 transition"
            >
              <span className="bg-primary-subtle text-primary flex size-8 shrink-0 items-center justify-center rounded-full font-semibold tabular-nums">
                {index + 1}
              </span>
              <span className="font-medium">{pick(locale, step.titleTh, step.titleEn)}</span>
            </Link>
          </li>
        ))}
      </ol>
      <section aria-labelledby="learn-next" className="bg-primary-subtle flex flex-col gap-3 rounded-2xl p-5">
        <h2 id="learn-next" className="font-semibold">
          {t("readyTitle")}
        </h2>
        <Button asChild className="self-start">
          <Link href={actionHref(path.action)}>{pick(locale, path.action.labelTh, path.action.labelEn)}</Link>
        </Button>
      </section>
    </div>
  );
}
