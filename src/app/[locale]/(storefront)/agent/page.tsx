import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { getPublicProgramme } from "@/features/customer/agent/api.server";
import { AgentStory } from "@/features/customer/agent/landing/AgentStory";
import { CommissionCalculator } from "@/features/customer/agent/landing/CommissionCalculator";
import { TrackedAnchor, TrackedLink } from "@/features/customer/business/landing/TrackedLink";
import { pick } from "@/features/customer/catalog/localize";
import { pageContext } from "@/features/customer/content/page-meta.server";
import { HOME_WRAP } from "@/features/customer/home/parts";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { faqPageSchema, webPageSchema } from "@/lib/seo";
import { Button } from "@/ui/components/Button";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

const SECTION = "scroll-mt-24 pt-14 md:pt-16";
const CARD = "border-border bg-surface rounded-panel border";
const STEPS: { key: "apply" | "sell" | "earn"; icon: IconName }[] = [
  { key: "apply", icon: "user-plus" },
  { key: "sell", icon: "send" },
  { key: "earn", icon: "wallet" },
];
const BENEFITS: { key: "link" | "quote" | "track" | "wht" | "app"; icon: IconName }[] = [
  { key: "link", icon: "link" },
  { key: "quote", icon: "document" },
  { key: "track", icon: "chart-line" },
  { key: "wht", icon: "receipt" },
  { key: "app", icon: "tablet" },
];
const AUDIENCE = ["freelance", "agency", "broker", "designer", "customer"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agent.landing");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), type: "website" },
  };
}

function SectionHead({ id, title, lead }: { id: string; title: string; lead?: string }) {
  return (
    <div className="mb-5">
      <h2 id={id} className="text-[1.625rem] leading-tight font-semibold">
        {title}
      </h2>
      {lead ? <p className="text-muted mt-1.5 max-w-[62ch] text-[14.5px]">{lead}</p> : null}
    </div>
  );
}

/**
 * getpack.co/agent (D-466, PLAN A-02): the public, indexable landing of the sales agent programme. Every figure comes
 * from `store.agentProgramme.public` (terms, days, examples, FAQs) and the calculator asks the API — the page claims
 * nothing of its own: no cap ("ไม่จำกัดรายได้"), never "฿0", no profit wording, nothing about production partners.
 */
export default async function AgentLandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, format, programme, current] = await Promise.all([
    getTranslations("agent.landing"),
    getFormat(),
    getPublicProgramme(),
    getLocale(),
  ]);
  const page = await pageContext("/agent", t("breadcrumb"));
  const terms = programme.terms;
  const faqs = programme.faqs.map((f) => ({
    question: pick(current, f.questionTh, f.questionEn),
    answer: pick(current, f.answerTh, f.answerEn),
  }));
  const lede = "text-muted mt-4 max-w-[50ch] text-[16.5px] leading-relaxed";

  const applyButton = (target: string, size: "lg" | "md" = "lg") => (
    <Button asChild size={size} className="w-full sm:w-auto">
      <TrackedLink event="agent_cta" target={target} href="/agent/apply">
        {t("hero.apply")}
      </TrackedLink>
    </Button>
  );

  return (
    <div>
      <JsonLd data={page.breadcrumb} />
      <JsonLd
        data={webPageSchema({
          name: t("metaTitle"),
          description: t("metaDescription"),
          url: page.url,
          locale: page.language,
        })}
      />
      {faqs.length ? <JsonLd data={faqPageSchema(faqs)} /> : null}

      <section aria-labelledby="agent-hero" className="bg-surface">
        <div
          className={cn(
            HOME_WRAP,
            "grid items-center gap-8 py-10 md:py-14 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:gap-12 xl:py-16",
          )}
        >
          <div>
            <h1
              id="agent-hero"
              className="text-[2.25rem] leading-[1.08] font-bold tracking-[-0.03em] text-balance md:text-[3.25rem] xl:text-[3.5rem]"
            >
              {t("hero.titleStart")} <em className="text-primary not-italic">{t("hero.titleEm")}</em>
            </h1>
            <p className={lede}>{t("hero.lede")}</p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              {applyButton("hero")}
              <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
                <TrackedAnchor event="agent_cta" target="commission" href="#commission">
                  {t("hero.howCta")}
                </TrackedAnchor>
              </Button>
            </div>
            <ul className="text-muted mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px]">
              {(["noFee", "noStock", "wht"] as const).map((point) => (
                <li key={point} className="flex items-center gap-1.5">
                  <Icon name="check" size={14} aria-hidden="true" className="text-primary shrink-0" />
                  {t(`hero.trust.${point}`)}
                </li>
              ))}
            </ul>
          </div>
          <AgentStory programme={programme} />
        </div>
      </section>

      <div className={cn(HOME_WRAP, "pb-6")}>
        <section aria-labelledby="agent-how" className={SECTION}>
          <SectionHead id="agent-how" title={t("how.title")} lead={t("how.lead")} />
          <ol className="grid gap-3 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.key} className={cn(CARD, "flex flex-col gap-2 p-5")}>
                <span className="flex items-center gap-3">
                  <span className="bg-primary text-primary-fg grid size-8 place-items-center rounded-full text-sm font-bold tabular-nums">
                    {index + 1}
                  </span>
                  <Icon name={step.icon} size={20} aria-hidden="true" className="text-primary" />
                </span>
                <b className="mt-1 text-base font-semibold">{t(`how.steps.${step.key}.title`)}</b>
                <p className="text-muted text-[13.5px] leading-relaxed">
                  {t(`how.steps.${step.key}.body`, { days: programme.paymentTermsDays })}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section id="commission" aria-labelledby="agent-commission" className={SECTION}>
          <SectionHead id="agent-commission" title={t("commission.title")} lead={t("commission.lead")} />
          {terms ? (
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="bg-primary-subtle border-primary/30 rounded-panel border p-5">
                    <p className="text-muted text-sm">{t("commission.first")}</p>
                    <p className="text-primary mt-1 text-[2.5rem] leading-none font-bold tabular-nums">
                      {format.percent(terms.firstOrderPct)}
                    </p>
                  </div>
                  <div className={cn(CARD, "p-5")}>
                    <p className="text-muted text-sm">{t("commission.repeat")}</p>
                    <p className="mt-1 text-[2.5rem] leading-none font-bold tabular-nums">
                      {format.percent(terms.repeatOrderPct)}
                    </p>
                    <p className="text-muted mt-1.5 text-xs">
                      {t("commission.repeatFor", { months: terms.attributionMonths })}
                    </p>
                  </div>
                </div>
                {programme.examples.length ? (
                  <div className={cn(CARD, "overflow-hidden")}>
                    <p className="border-border border-b px-5 py-3 text-sm font-semibold">{t("commission.examples")}</p>
                    <table className="w-full text-sm" aria-label={t("commission.examples")}>
                      <thead className="text-muted border-border border-b text-xs">
                        <tr>
                          <th scope="col" className="px-5 py-2 text-left font-medium">
                            {t("commission.colOrder")}
                          </th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">
                            {t("commission.first")}
                          </th>
                          <th scope="col" className="px-5 py-2 text-right font-medium">
                            {t("commission.repeat")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {programme.examples.map((row) => (
                          <tr key={row.orderValue} className="border-border border-b last:border-b-0">
                            <th scope="row" className="px-5 py-3 text-left font-medium tabular-nums">
                              {t("commission.exampleRow", { value: format.thb(row.orderValue) })}
                            </th>
                            <td className="text-primary px-3 py-3 text-right font-semibold tabular-nums">
                              {format.thb(row.firstOrder)}
                            </td>
                            <td className="text-muted px-5 py-3 text-right tabular-nums">
                              {format.thb(row.repeatOrder)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <p className="text-muted text-[13px]">{t("commission.when")}</p>
              </div>
              <CommissionCalculator initial={programme.examples[1] ?? null} />
            </div>
          ) : (
            <p className="text-muted text-sm">{t("commission.noTerms")}</p>
          )}
        </section>

        <section aria-labelledby="agent-benefits" className={SECTION}>
          <SectionHead id="agent-benefits" title={t("benefits.title")} />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {BENEFITS.map((item, index) => (
              <li
                key={item.key}
                className={cn(
                  CARD,
                  "flex flex-col gap-1.5 p-5",
                  index < 3 ? "lg:col-span-2" : "lg:col-span-3",
                  index === 4 && "sm:col-span-2 lg:col-span-3",
                )}
              >
                <span className="bg-primary-subtle text-primary rounded-control grid size-9.5 place-items-center">
                  <Icon name={item.icon} size={20} aria-hidden="true" />
                </span>
                <b className="mt-1 text-base font-semibold">{t(`benefits.items.${item.key}.title`)}</b>
                <p className="text-muted text-[13.5px] leading-relaxed">
                  {t(`benefits.items.${item.key}.body`, { days: programme.linkCookieDays })}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="agent-audience" className={SECTION}>
          <SectionHead id="agent-audience" title={t("audience.title")} />
          <ul className="flex flex-wrap gap-2">
            {AUDIENCE.map((key) => (
              <li key={key} className="border-border bg-surface rounded-control border px-4 py-2 text-sm">
                {t(`audience.items.${key}`)}
              </li>
            ))}
          </ul>
        </section>

        {faqs.length ? (
          <section aria-labelledby="agent-faq" className={SECTION}>
            <SectionHead id="agent-faq" title={t("faq.title")} />
            <div className="divide-border border-border rounded-panel bg-surface divide-y border">
              {faqs.map((faq) => (
                <details key={faq.question} className="group px-5">
                  <summary className="focus-visible:ring-focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <Icon
                      name="chevron-down"
                      size={18}
                      aria-hidden="true"
                      className="text-muted shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    />
                  </summary>
                  <p className="text-muted pb-4 text-[14.5px] leading-relaxed">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        <section aria-labelledby="agent-final" className={SECTION}>
          <div className="bg-primary-subtle border-primary/30 rounded-panel flex flex-col items-start gap-4 border p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div>
              <h2 id="agent-final" className="text-[1.5rem] leading-tight font-semibold">
                {t("final.title")}
              </h2>
              <p className="text-muted mt-1.5 text-[14.5px]">{t("final.body")}</p>
            </div>
            {applyButton("final")}
          </div>
          <p className="text-muted mt-5 text-sm">
            <Link href="/partner-with-us" className="hover:text-fg underline underline-offset-4">
              {t("partners")}
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
