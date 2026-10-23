import { getTranslations } from "next-intl/server";

import { pageContext } from "@/features/customer/content/page-meta.server";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { serviceSchema, webPageSchema } from "@/lib/seo";
import { Button } from "@/ui/components/Button";
import { Icon, type IconName } from "@/ui/icons";

const BENEFITS: { key: string; icon: IconName }[] = [
  { key: "team", icon: "users" },
  { key: "approval", icon: "check" },
  { key: "credit", icon: "wallet" },
  { key: "invoices", icon: "file-check" },
  { key: "branches", icon: "building" },
  { key: "reorder", icon: "refresh" },
];

/** getpack for business, for a visitor (F3 3.7): what a company account adds, and how to open one. */
export async function BusinessLanding({ signedIn }: { signedIn: boolean }) {
  const t = await getTranslations("business.landing");
  const page = await pageContext("/business", t("metaTitle"));
  return (
    <div className="flex flex-col gap-14">
      <JsonLd data={page.breadcrumb} />
      <JsonLd
        data={webPageSchema({ name: t("metaTitle"), description: t("intro"), url: page.url, locale: page.language })}
      />
      <JsonLd
        data={serviceSchema({
          name: t("metaTitle"),
          description: t("intro"),
          url: page.url,
          serviceType: "Business packaging procurement account",
        })}
      />
      <header className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-4xl leading-[1.12] md:text-5xl lg:text-[3.5rem]">{t("title")}</h1>
        <p className="text-muted max-w-[40em] text-lg leading-relaxed">{t("intro")}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Button asChild size="lg" iconEnd="arrow-right">
            <Link href={signedIn ? "/business/apply" : `/sign-in?returnTo=${encodeURIComponent("/business/apply")}`}>
              {t("apply")}
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/contact">{t("talk")}</Link>
          </Button>
        </div>
      </header>
      <section aria-labelledby="business-benefits">
        <h2 id="business-benefits" className="text-2xl">
          {t("benefits")}
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <li key={benefit.key} className="border-border bg-surface rounded-card flex flex-col gap-4 border p-6">
              <span className="bg-primary-subtle text-primary rounded-control grid size-11 place-items-center">
                <Icon name={benefit.icon} size={22} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-[17px] font-semibold">{t(`benefit.${benefit.key}.title`)}</h3>
                <p className="text-muted mt-1.5 text-sm leading-relaxed">{t(`benefit.${benefit.key}.body`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section
        aria-labelledby="business-steps"
        className="rounded-card bg-sage text-fg-inverse relative overflow-hidden p-7 md:p-10"
      >
        <h2 id="business-steps" className="serif relative text-[1.75rem]">
          {t("stepsTitle")}
        </h2>
        <ol className="relative mt-6 grid gap-6 md:grid-cols-3">
          {(["one", "two", "three"] as const).map((step, index) => (
            <li key={step} className="border-fg-inverse/15 flex gap-4 border-t pt-5">
              <span className="serif text-fg-inverse shrink-0 text-4xl leading-none" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="font-semibold">{t(`steps.${step}.title`)}</p>
                <p className="text-fg-inverse mt-1 text-sm leading-relaxed">{t(`steps.${step}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
