import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { listFaqs } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { DisclosureList } from "@/ui/components/DisclosureList";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { Icon, type IconName } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help.centre");
  return { title: t("title"), description: t("intro") };
}

const TOPICS: { key: string; href: string; icon: IconName }[] = [
  { key: "howItWorks", href: "/help/how-it-works", icon: "route" },
  { key: "track", href: "/track", icon: "truck" },
  { key: "artwork", href: "/faq#artwork", icon: "file-check" },
  { key: "payment", href: "/faq#payment", icon: "wallet" },
  // Sample kits wait for the samples work (U2.4, D-223); the topic comes back with them.
  { key: "business", href: "/business", icon: "building" },
];

/**
 * The help centre (F3 3.7): search, the common topics, the questions asked most, and a person
 * when none of that answers it — the guided chat, or the contact form.
 */
export default async function Page() {
  const [t, locale, groups] = await Promise.all([getTranslations("help.centre"), getLocale(), listFaqs()]);
  const top = groups.flatMap((group) => group.faqs).slice(0, 6);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("intro")}</p>
        <form
          action="/search"
          method="get"
          role="search"
          aria-label={t("search")}
          className="flex max-w-xl items-end gap-2"
        >
          <Field label={t("search")} labelHidden className="flex-1">
            <Input type="search" name="q" placeholder={t("searchPlaceholder")} />
          </Field>
          <Button type="submit" iconStart="search">
            {t("searchButton")}
          </Button>
        </form>
      </header>

      <section aria-labelledby="help-topics">
        <h2 id="help-topics" className="text-lg font-semibold">
          {t("topics")}
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOPICS.map((topic) => (
            <li key={topic.key}>
              <Link
                href={topic.href}
                className="border-border hover:border-primary flex h-full items-start gap-3 rounded-xl border p-4"
              >
                <Icon name={topic.icon} size={20} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  <span className="block font-medium">{t(`topic.${topic.key}.title`)}</span>
                  <span className="text-muted block text-sm">{t(`topic.${topic.key}.body`)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {top.length > 0 ? (
        <section aria-labelledby="help-faq">
          <h2 id="help-faq" className="text-lg font-semibold">
            {t("faq")}
          </h2>
          <DisclosureList
            className="mt-4"
            headingLevel="h3"
            items={top.map((faq) => ({
              summary: pick(locale, faq.questionTh, faq.questionEn),
              content: pick(locale, faq.answerTh, faq.answerEn),
            }))}
          />
          <Link href="/faq" className="text-primary mt-3 inline-block text-sm underline underline-offset-4">
            {t("allFaq")}
          </Link>
        </section>
      ) : null}

      <section aria-labelledby="help-person" className="bg-surface-subtle flex flex-col gap-3 rounded-2xl p-6">
        <h2 id="help-person" className="text-lg font-semibold">
          {t("person")}
        </h2>
        <p className="text-muted">{t("personBody")}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild iconStart="chat">
            <Link href="/help/chat">{t("chat")}</Link>
          </Button>
          <Button asChild variant="secondary" iconStart="mail">
            <Link href="/contact">{t("contact")}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
