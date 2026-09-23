import { getTranslations, setRequestLocale } from "next-intl/server";

import { BOX_STYLES } from "@/features/designer/catalog";
import { BoxPreview } from "@/features/designer/components/BoxPreview";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Card, CardDescription, CardTitle } from "@/ui/components/Card";

/**
 * Customer home. A placeholder until F3 builds the real storefront — the point of it is that
 * it is built entirely from `src/ui` and `src/i18n`, with no colour utility and no string of
 * its own. The shell around it comes from `(storefront)/layout.tsx`.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");

  const steps = [
    { title: t("steps.chooseTitle"), body: t("steps.chooseBody") },
    { title: t("steps.designTitle"), body: t("steps.designBody") },
    { title: t("steps.exportTitle"), body: t("steps.exportBody") },
  ];

  return (
    <>
      <section className="bg-bg-subtle">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <h1 className="text-4xl leading-tight font-bold md:text-5xl">
              {t("hero.titleLine1")}
              <br />
              <span className="text-primary">{t("hero.titleLine2")}</span>
            </h1>
            <p className="text-muted mt-4 max-w-md text-lg">{t("hero.body", { tagline: tCommon("brand.tagline") })}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/design/new">{tCommon("nav.startDesigning")}</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/account/designs">{tCommon("nav.myDesigns")}</Link>
              </Button>
            </div>
          </div>
          <Card elevation="raised" padding="lg" className="aspect-[4/3] rounded-2xl">
            {/* The product, not a stock photo: a real dieline from @packio/dieline. */}
            <BoxPreview
              style="tuck-end"
              dims={{ length: 70, width: 40, height: 110 }}
              paper="ivory-350"
              label={t("styles.heading")}
            />
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-8 text-2xl font-semibold">{t("styles.heading")}</h2>
        <ul className="grid gap-6 md:grid-cols-3">
          {BOX_STYLES.map((style) => (
            <Card as="li" key={style.id} padding="md">
              <div className="bg-surface-subtle aspect-[4/3] rounded-lg p-4">
                <BoxPreview style={style.id} dims={style.presets[0].dims} paper="e-kraft" />
              </div>
              <CardTitle as="h3" className="mt-4 text-base">
                {style.name}
              </CardTitle>
              <CardDescription className="mt-1">{style.description}</CardDescription>
            </Card>
          ))}
        </ul>
      </section>

      <section className="bg-bg-subtle">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="mb-8 text-2xl font-semibold">{t("steps.heading")}</h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span
                  aria-hidden
                  className="bg-primary text-primary-fg mb-3 flex size-9 items-center justify-center rounded-full font-semibold"
                >
                  {index + 1}
                </span>
                <h3 className="font-medium">{step.title}</h3>
                <p className="text-muted mt-1 text-sm">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
