import { getLocale, getTranslations } from "next-intl/server";

import { getContactOptions, getPublicConfig, getSupportChannels } from "@/features/customer/catalog/api.server";
import { pageContext } from "@/features/customer/content/page-meta.server";
import { HOME_WRAP } from "@/features/customer/home/parts";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { faqPageSchema, serviceSchema, webPageSchema } from "@/lib/seo";
import { Button } from "@/ui/components/Button";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { ApprovalSimulator } from "./landing/ApprovalSimulator";
import { ControlDemo } from "./landing/ControlDemo";
import { DashboardIllustration } from "./landing/DashboardIllustration";
import { DocChecklist } from "./landing/DocChecklist";
import { RoiCalculator } from "./landing/RoiCalculator";
import { SalesForm } from "./landing/SalesForm";
import { pricedSamples, sampleOrders } from "./landing/samples.server";
import { TrackedAnchor, TrackedLink } from "./landing/TrackedLink";

/** The company-account features the page has copy and icons for, in `storefront.roadmap`'s keys (D-458). */
const FEATURE_ICONS: Record<string, IconName> = {
  team: "users",
  reorder: "spreadsheet",
  approval: "shield-check",
  credit: "credit-card",
  invoices: "receipt",
  branches: "split",
  brand_lock: "lock",
  stock_alert: "bell",
  production_evidence: "scan",
  etax_export: "document",
  api: "link",
};
/** Wide (half-row) cards of the bento; the rest take a third. */
const WIDE = new Set(["team", "reorder", "production_evidence", "etax_export", "api"]);
const AUDIENCE: { key: string; icon?: IconName }[] = [
  { key: "chains", icon: "split" },
  { key: "brands" },
  { key: "food" },
  { key: "makers" },
  { key: "agencies" },
  { key: "procurement" },
];
const BEFORE = ["quote", "approval", "branches", "reorder"] as const;
const ROLES = ["admin", "buyer", "approver", "accountant"] as const;
const CREDIT_STEPS = ["open", "prepaid", "apply", "monthly"] as const;
const TERMS = [15, 30, 45, 60] as const;
const APPLY_STEPS = ["one", "two", "three"] as const;
const FAQ = ["cost", "waiting", "credit", "branches", "contract", "agency"] as const;
const VISIBILITY = ["status", "quality", "delivery"] as const;
const SECTION = "scroll-mt-24 pt-14 md:pt-16";
const CARD = "border-border bg-surface rounded-panel border";
const PAY_ICONS: Record<string, IconName> = {
  bank_transfer_slip: "coins",
  scb_qr: "scan",
  scb_qr_cross_bank: "scan",
  card_2c2p: "credit-card",
  online_banking_2c2p: "tablet",
  scb_direct_debit: "refresh",
};

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
 * getpack for business, for a visitor (business pack Phase 1, C10): dark hero with the account illustration, who it
 * is for, before → after, the features (live and "เร็ว ๆ นี้" from `storefront.roadmap`), the approval simulator on
 * real prices, the catalogue and budget demo, the ROI calculator, the credit path, opening an account with the
 * document checklist, purchasing FAQ, what customers see during production, and the sales form. Every figure is the
 * API's (prices, price lock, reply days, payment methods, issuer) or the visitor's own; nothing is sample data.
 */
export async function BusinessLanding({ signedIn }: { signedIn: boolean }) {
  const locale = await getLocale();
  const [t, config, channels, options, products] = await Promise.all([
    getTranslations("business.landing"),
    getPublicConfig(),
    getSupportChannels(),
    getContactOptions(),
    pricedSamples(locale),
  ]);
  const page = await pageContext("/business", t("metaTitle"));
  const applyHref = signedIn ? "/business/apply" : `/sign-in?returnTo=${encodeURIComponent("/business/apply")}`;
  // Without the roadmap the page claims only what the pack calls live, and shows no "เร็ว ๆ นี้" card.
  const features = (config?.roadmap.business ?? [])
    .filter((item) => item.key in FEATURE_ICONS)
    .map((item) => ({ key: item.key, soon: item.status !== "live" }));
  const soon = t("features.soon");
  const issuer =
    locale === "en" ? (config?.issuer.legalNameEn ?? config?.issuer.legalNameTh) : config?.issuer.legalNameTh;
  const methods = (config?.paymentMethods ?? []).filter((method) => method in PAY_ICONS);
  const faq = FAQ.map((key) => ({ key, question: t(`faq.items.${key}.q`), answer: t(`faq.items.${key}.a`) }));
  const replyDays = options?.replyBusinessDaysByTopic.business ?? options?.replyBusinessDays ?? null;
  const salesPoints: { key: string; icon: IconName; text: string }[] = [
    ...(replyDays !== null
      ? [{ key: "reply", icon: "check" as const, text: t("sales.points.reply", { days: replyDays }) }]
      : []),
    { key: "specs", icon: "check", text: t("sales.points.specs") },
    { key: "samples", icon: "check", text: t("sales.points.samples") },
    ...(channels?.lineOaId
      ? [{ key: "line", icon: "chat" as const, text: t("sales.points.line", { hours: channels.hours ?? "" }).trim() }]
      : []),
  ];

  return (
    <div className="pb-6">
      <JsonLd data={page.breadcrumb} />
      <JsonLd
        data={webPageSchema({
          name: t("metaTitle"),
          description: t("metaDescription"),
          url: page.url,
          locale: page.language,
        })}
      />
      <JsonLd
        data={serviceSchema({
          name: t("metaTitle"),
          description: t("intro"),
          url: page.url,
          serviceType: "Business packaging procurement account",
        })}
      />
      <JsonLd data={faqPageSchema(faq.map(({ question, answer }) => ({ question, answer })))} />

      {/* The hero (Project A): light like the rest of the storefront — the surface with a hairline under it; it was a
          forced dark band. */}
      <section aria-labelledby="business-hero" className="bg-surface border-border text-fg border-b">
        <div
          className={cn(
            HOME_WRAP,
            "grid items-center gap-10 py-12 md:py-16 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:gap-12",
          )}
        >
          <div>
            <h1
              id="business-hero"
              className="text-[2.25rem] leading-[1.08] font-bold tracking-[-0.03em] text-balance md:text-[3.25rem] xl:text-[3.625rem]"
            >
              {t("titleStart")} <em className="text-primary not-italic">{t("titleEm")}</em>
            </h1>
            <p className="text-muted mt-4 max-w-[48ch] text-[16.5px] leading-relaxed">{t("intro")}</p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Button asChild size="lg" iconEnd="arrow-right">
                <TrackedLink event="biz_cta" target="apply" href={applyHref}>
                  {t("apply")}
                </TrackedLink>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <TrackedAnchor event="biz_cta" target="sales" href="#sales">
                  {t("talk")}
                </TrackedAnchor>
              </Button>
            </div>
            <dl className="mt-8 flex flex-wrap gap-x-7 gap-y-3">
              {(["credit", "review", "roles"] as const).map((fact) => (
                <div key={fact} className="flex flex-col-reverse">
                  <dt className="text-muted text-[13px]">{t(`facts.${fact}.label`)}</dt>
                  <dd className="text-2xl leading-tight font-bold tabular-nums">{t(`facts.${fact}.value`)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <DashboardIllustration />
        </div>
      </section>

      <div className={HOME_WRAP}>
        <div
          role="list"
          aria-label={t("audienceLabel")}
          className="border-border flex flex-wrap items-center gap-2 border-b py-5.5"
        >
          <span className="text-muted mr-1.5 text-[13.5px]" aria-hidden="true">
            {t("audienceLabel")}
          </span>
          {AUDIENCE.map((item) => (
            <span
              key={item.key}
              role="listitem"
              className="border-border-strong bg-surface text-muted rounded-control inline-flex items-center gap-1.5 border px-3.5 py-1.5 text-[13.5px]"
            >
              {item.icon ? <Icon name={item.icon} size={15} aria-hidden="true" /> : null}
              {t(`audience.${item.key}`)}
            </span>
          ))}
        </div>

        <section aria-labelledby="business-before" className={SECTION}>
          <SectionHead id="business-before" title={t("before.title")} lead={t("before.lead")} />
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {BEFORE.map((key) => (
              <li key={key} className={cn(CARD, "flex flex-col overflow-hidden")}>
                <div className="bg-bg-subtle text-muted p-4 text-[13.5px]">
                  <span className="mb-1 block text-[11px] font-medium tracking-[0.06em] uppercase">
                    {t("before.was")}
                  </span>
                  <s className="text-muted">{t(`before.items.${key}.before`)}</s>
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-4">
                  <span className="text-primary text-[11px] font-medium tracking-[0.06em] uppercase">
                    {t("before.now")}
                  </span>
                  <b className="text-base font-semibold">{t(`before.items.${key}.title`)}</b>
                  <p className="text-muted text-[13.5px]">
                    {key === "quote"
                      ? config?.priceLockDays
                        ? t("before.items.quote.body", { days: config.priceLockDays })
                        : t("before.items.quote.bodyNoDays")
                      : t(`before.items.${key}.body`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {features.length > 0 ? (
          <section aria-labelledby="business-features" className={SECTION}>
            <SectionHead id="business-features" title={t("features.title")} />
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              {features.map((feature) => (
                <li
                  key={feature.key}
                  className={cn(
                    CARD,
                    "relative flex flex-col gap-2 p-5",
                    WIDE.has(feature.key) ? "xl:col-span-3" : "xl:col-span-2",
                  )}
                >
                  <span className="bg-primary-subtle text-primary rounded-control grid size-10 place-items-center">
                    <Icon name={FEATURE_ICONS[feature.key]!} size={21} aria-hidden="true" />
                  </span>
                  <h3 className="mt-1 text-[17px] font-semibold">{t(`features.items.${feature.key}.title`)}</h3>
                  <p className="text-muted text-sm">{t(`features.items.${feature.key}.body`)}</p>
                  {feature.key === "team" ? (
                    <ul className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {ROLES.map((role) => (
                        <li key={role} className="bg-bg-subtle rounded-control p-2 text-center text-[12.5px]">
                          <b className="block text-[13px] font-semibold">{t(`features.roles.${role}.title`)}</b>
                          {t(`features.roles.${role}.body`)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {feature.key === "reorder" ? (
                    <pre
                      aria-label={t("features.csvLabel")}
                      className="bg-bg-subtle text-muted rounded-control mt-1.5 overflow-x-auto px-3 py-2.5 text-xs leading-[1.7] tabular-nums"
                    >
                      {t("features.csvSample")}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="business-sim" className={SECTION}>
          <SectionHead id="business-sim" title={t("sim.title")} lead={t("sim.lead")} />
          <ApprovalSimulator orders={sampleOrders(products)} />
        </section>

        <section aria-labelledby="business-control" className={SECTION}>
          <SectionHead id="business-control" title={t("control.title")} lead={t("control.lead")} />
          <ControlDemo
            products={products}
            soonLabel={soon}
            // Owner rule (Project A): every module is live — no "เร็ว ๆ นี้" badge anywhere in the storefront.
            catalogueSoon={false}
            budgetsSoon={false}
          />
        </section>

        <section aria-labelledby="business-roi" className={SECTION}>
          <SectionHead id="business-roi" title={t("roi.title")} lead={t("roi.lead")} />
          <RoiCalculator />
        </section>

        <section aria-labelledby="business-credit" className={SECTION}>
          <SectionHead id="business-credit" title={t("credit.title")} />
          <ol className={cn(CARD, "grid overflow-hidden md:grid-cols-2 xl:grid-cols-4")}>
            {CREDIT_STEPS.map((step, index) => (
              <li
                key={step}
                className={cn(
                  "border-border flex flex-col gap-1.5 p-5.5",
                  [
                    "border-b md:border-r xl:border-b-0",
                    "border-b xl:border-r xl:border-b-0",
                    "border-b md:border-r md:border-b-0",
                    "bg-primary-subtle",
                  ][index],
                )}
              >
                <span className="text-muted text-xs">{t(`credit.steps.${step}.when`)}</span>
                <b className="text-[17px] font-semibold">{t(`credit.steps.${step}.title`)}</b>
                <p className="text-muted text-[13.5px]">{t(`credit.steps.${step}.body`)}</p>
                {step === "monthly" ? (
                  <ul aria-label={t("credit.terms")} className="mt-1 flex flex-wrap gap-1.5">
                    {TERMS.map((days) => (
                      <li
                        key={days}
                        className="bg-surface border-border rounded-control border px-2.5 py-1 text-[13px] font-semibold tabular-nums"
                      >
                        {t("credit.term", { days })}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
          <ul
            aria-label={t("credit.methods")}
            className="text-muted mt-3.5 flex flex-wrap gap-x-4.5 gap-y-2 text-[13.5px]"
          >
            {methods.map((method) => (
              <li key={method} className="inline-flex items-center gap-1.5">
                <Icon name={PAY_ICONS[method]!} size={16} aria-hidden="true" className="text-primary" />
                {t(`credit.method.${method}`)}
              </li>
            ))}
            <li className="inline-flex items-center gap-1.5">
              <Icon name="building" size={16} aria-hidden="true" className="text-primary" />
              {issuer ? t("credit.issuer", { name: issuer }) : t("credit.issuerPlain")}
            </li>
          </ul>
        </section>

        <section id="apply" aria-labelledby="business-apply" className={SECTION}>
          <SectionHead id="business-apply" title={t("applySection.title")} />
          <div className="grid gap-5 xl:grid-cols-2">
            <div>
              <ol>
                {APPLY_STEPS.map((step, index) => (
                  <li
                    key={step}
                    className="border-border grid grid-cols-[3rem_minmax(0,1fr)] gap-4 border-b py-4.5 last:border-b-0"
                  >
                    <span className="bg-primary-subtle text-primary-subtle-fg rounded-card grid size-12 place-items-center text-lg font-bold tabular-nums">
                      {index + 1}
                    </span>
                    <span>
                      <b className="block text-[17px] font-semibold">{t(`applySection.steps.${step}.title`)}</b>
                      <span className="text-muted mt-1 block text-sm">{t(`applySection.steps.${step}.body`)}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <Button asChild iconEnd="arrow-right">
                  <TrackedLink event="biz_cta" target="apply_section" href={applyHref}>
                    {t("applySection.open")}
                  </TrackedLink>
                </Button>
                <Button asChild variant="secondary">
                  <TrackedAnchor event="biz_cta" target="sales_from_apply" href="#sales">
                    {t("applySection.ask")}
                  </TrackedAnchor>
                </Button>
              </div>
            </div>
            <DocChecklist />
          </div>
        </section>

        <section aria-labelledby="business-faq" className={SECTION}>
          <SectionHead id="business-faq" title={t("faq.title")} />
          <div className="grid gap-x-8 md:grid-cols-2">
            {faq.map((item) => (
              <details key={item.key} className="border-border group border-b">
                <summary className="focus-visible:ring-focus-ring flex cursor-pointer list-none items-start justify-between gap-3 py-4 text-[15px] font-semibold outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <Icon
                    name="chevron-down"
                    size={18}
                    aria-hidden="true"
                    className="text-muted mt-0.5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <p className="text-muted mb-4 max-w-[60ch] text-[14.5px]">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="business-visibility" className={SECTION}>
          <SectionHead id="business-visibility" title={t("visibility.title")} lead={t("visibility.lead")} />
          <ul className="grid gap-3 md:grid-cols-3">
            {VISIBILITY.map((key) => (
              <li key={key} className={cn(CARD, "flex flex-col gap-1.5 p-4")}>
                <span className="text-primary text-[11px] font-medium tracking-[0.06em] uppercase">
                  {t(`visibility.items.${key}.label`)}
                </span>
                <b className="text-base font-semibold">{t(`visibility.items.${key}.title`)}</b>
                <p className="text-muted text-[13.5px]">{t(`visibility.items.${key}.body`)}</p>
              </li>
            ))}
          </ul>
          <div className="border-border bg-instant-subtle/40 rounded-panel mt-3.5 grid items-center gap-5 border p-5.5 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
            <span className="border-border bg-surface text-primary rounded-card grid size-13 place-items-center border">
              <Icon name="factory" size={26} aria-hidden="true" />
            </span>
            <div>
              <b className="block text-lg font-semibold">{t("visibility.bandTitle")}</b>
              <p className="text-muted mt-1 text-sm">{t("visibility.bandBody")}</p>
            </div>
            <Button asChild iconEnd="arrow-right" className="w-full sm:w-auto">
              <TrackedLink event="biz_cta" target="partner" href="/partner-with-us">
                {t("visibility.bandCta")}
              </TrackedLink>
            </Button>
          </div>
        </section>
      </div>

      <div className={cn(HOME_WRAP, "scroll-mt-24 pt-16 pb-16 md:pb-20")} id="sales">
        {/* Talk to sales on the pale brand tint (no dark block); the form keeps its white fields. */}
        <section
          aria-labelledby="sales-title"
          className="bg-primary-subtle text-fg rounded-panel grid gap-6 overflow-hidden p-5 sm:p-9 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
        >
          <div>
            <h2
              id="sales-title"
              className="text-[clamp(1.625rem,3vw,2.25rem)] leading-[1.15] font-bold tracking-[-0.02em]"
            >
              {t("sales.title")}
            </h2>
            <p className="text-muted mt-2.5">{t("sales.lead")}</p>
            <ul className="text-muted mt-5 flex flex-col gap-2.5 text-[14.5px]">
              {salesPoints.map((point) => (
                <li key={point.key} className="flex gap-2.5">
                  <Icon name={point.icon} size={18} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
                  {point.text}
                </li>
              ))}
            </ul>
          </div>
          <SalesForm applyHref={applyHref} />
        </section>
      </div>
    </div>
  );
}
