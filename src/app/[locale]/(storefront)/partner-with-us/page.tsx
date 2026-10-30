import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { TrackedAnchor } from "@/features/customer/business/landing/TrackedLink";
import { getProductTypes, getProvinces, getPublicConfig } from "@/features/customer/catalog/api.server";
import { showcasePhotos } from "@/features/customer/styles/showcase.server";
import { pick } from "@/features/customer/catalog/localize";
import { pageContext } from "@/features/customer/content/page-meta.server";
import { FactoryApplyForm } from "@/features/customer/factory-programme/FactoryApplyForm";
import { OperatorPhone } from "@/features/customer/factory-programme/Illustrations";
import { HOME_WRAP } from "@/features/customer/home/parts";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { zoneHosts } from "@/lib/env/server";
import { faqPageSchema, serviceSchema, webPageSchema } from "@/lib/seo";
import { Button } from "@/ui/components/Button";
import { HeroFlow } from "@/ui/components/HeroFlow";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

/** The getpack Factory modules the page has copy for, in `storefront.roadmap.erpModules` keys (D-458). */
const MODULE_ICONS: Record<string, IconName> = {
  getpack_jobs: "handshake",
  roles: "users",
  stock: "warehouse",
  purchasing: "cart",
  planning: "gantt",
  shop_floor: "tablet",
  sales: "chart-line",
  accounting: "receipt",
  documents: "folder",
  maintenance: "wrench",
  suppliers: "building",
};
/** Highlighted, two columns wide (pack Phase 3 item 3). */
const HIGHLIGHT = new Set(["getpack_jobs", "accounting"]);
const FLOOR: { key: "start" | "photos" | "repair"; icon: IconName }[] = [
  { key: "start", icon: "tablet" },
  { key: "photos", icon: "image" },
  { key: "repair", icon: "wrench" },
];
const ROWS = ["cost", "jobs", "fit", "accounting", "start", "status"] as const;
const TIERS = ["full", "partial", "quote"] as const;
const SOURCES = ["rate_card", "price_list"] as const;
const FAQ = ["free", "data", "names", "nonSolicit", "accounting", "modules"] as const;
/** C12 (D-460, legal draft pending review by a licensed Thai lawyer): the partner agreement's key clauses. */
const TERMS = ["counterparty", "nonSolicit", "confidentiality", "whiteLabel"] as const;
const SECTION = "scroll-mt-24 pt-14 md:pt-16";
const CARD = "border-border bg-surface rounded-panel border";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.partner");
  return { title: t("metaTitle"), description: t("metaDescription") };
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
 * getpack Factory (business pack Phase 3, C10) — the only customer-zone page that talks TO factories (GLOBAL-RULES §1
 * exception): the free whole-factory ERP offer (free, every module, unlimited users, after a factory account and the
 * partner agreement — never why it is free, §2), job sources, the modules with their status from `storefront.roadmap`,
 * the shop floor, the comparison, participation tiers and price sources, the application (a contact ticket routed to
 * the Partner team, D-458) and the factory FAQ. Nothing names, counts or describes existing partner factories, and
 * no payment or delivery terms (they are in the partner agreement only).
 */
export default async function PartnerWithUsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, headerList, config, types, provinces] = await Promise.all([
    getTranslations("pages.partner"),
    headers(),
    getPublicConfig(),
    getProductTypes().catch(() => []),
    getProvinces(),
  ]);
  const page = await pageContext("/partner-with-us", t("title"));
  const photos = await showcasePhotos(locale, 4, 5);
  const scheme = headerList.get("x-forwarded-proto") ?? (zoneHosts.partner.startsWith("localhost") ? "http" : "https");
  const partnerLoginUrl = `${scheme}://${zoneHosts.partner}/login`;
  const modules = (config?.roadmap.erpModules ?? []).filter((item) => item.key in MODULE_ICONS);
  const faq = FAQ.map((key) => ({ key, question: t(`faq.items.${key}.q`), answer: t(`faq.items.${key}.a`) }));
  const lede = "text-muted mt-4 max-w-[50ch] text-[16.5px] leading-relaxed";

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
      <JsonLd
        data={serviceSchema({
          name: "getpack Factory",
          description: t("metaDescription"),
          url: page.url,
          serviceType: "Packaging factory ERP and production partner programme",
        })}
      />
      <JsonLd data={faqPageSchema(faq.map(({ question, answer }) => ({ question, answer })))} />

      {/* Project A: a light hero like the rest of the storefront (it was a forced dark band). */}
      <section aria-labelledby="factory-hero" className="bg-surface border-border text-fg border-b">
        <div
          className={cn(
            HOME_WRAP,
            "grid items-center gap-10 py-12 md:py-16 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:gap-12",
          )}
        >
          <div>
            <h1
              id="factory-hero"
              className="text-[2.25rem] leading-[1.08] font-bold tracking-[-0.03em] text-balance md:text-[3.25rem] xl:text-[3.625rem]"
            >
              {t("titleStart")} <em className="text-primary not-italic">{t("titleEm")}</em> {t("titleEnd")}
            </h1>
            <p className={lede}>{t("lede")}</p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <TrackedAnchor event="fx_cta" target="apply" href="#apply">
                  {t("apply")}
                </TrackedAnchor>
              </Button>
              <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
                <TrackedAnchor event="fx_cta" target="modules" href="#modules">
                  {t("modulesCta")}
                </TrackedAnchor>
              </Button>
            </div>
            <p className="border-border bg-surface rounded-card mt-5.5 inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 border px-3.5 py-2.5 text-sm">
              <b className="text-instant text-[1.375rem] font-bold tabular-nums">{t("offerPrice")}</b>
              <span className="text-muted">{t("offer")}</span>
            </p>
            <p className="mt-4 text-sm">
              <a href={partnerLoginUrl} className="text-muted hover:text-fg underline underline-offset-4">
                {t("login")}
              </a>
            </p>
          </div>
          {/* The hero's picture (owner decision 2026-10-30): a getpack job's path through the partner, each step with
              a real product photo, on a curve a dot travels. */}
          <HeroFlow
            id="factory-flow"
            label={t("flow.label")}
            promise={t("modules.items.getpack_jobs.title")}
            steps={[
              { key: "job", title: t("sources.getpack.title"), caption: t("modules.items.getpack_jobs.title") },
              { key: "make", title: t("flow.make"), caption: t("floor.points.start.title") },
              { key: "qc", title: t("board.columns.qc"), caption: t("floor.points.photos.title") },
              { key: "ship", title: t("flow.ship"), caption: t("flow.shipCaption") },
              { key: "bill", title: t("flow.bill"), caption: t("flow.billCaption") },
            ].map((step, index) => ({ ...step, photo: photos[index]! }))}
          />
        </div>
      </section>

      <div className={cn(HOME_WRAP, "pb-6")}>
        <section aria-labelledby="factory-sources" className={SECTION}>
          <SectionHead id="factory-sources" title={t("sources.title")} lead={t("sources.lead")} />
          <div className="grid items-center gap-3.5 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1.1fr)]">
            {(["getpack", "own"] as const).map((source, index) => (
              <div key={source} className="contents">
                <div className={cn(CARD, "flex h-full flex-col gap-1.5 p-4.5")}>
                  <b className="text-base font-semibold">{t(`sources.${source}.title`)}</b>
                  <p className="text-muted text-[13.5px]">{t(`sources.${source}.body`)}</p>
                </div>
                <span aria-hidden="true" className="text-muted hidden text-center text-2xl font-bold xl:block">
                  {index === 0 ? "+" : "="}
                </span>
              </div>
            ))}
            <div className="bg-primary-subtle text-fg border-primary/30 rounded-panel flex h-full flex-col gap-1.5 border p-4.5">
              <b className="text-base font-semibold">{t("sources.hub.title")}</b>
              <p className="text-muted text-[13.5px]">{t("sources.hub.body")}</p>
            </div>
          </div>
        </section>

        {modules.length > 0 ? (
          <section id="modules" aria-labelledby="factory-modules" className={SECTION}>
            <SectionHead id="factory-modules" title={t("modules.title")} lead={t("modules.lead")} />
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {modules.map((module) => {
                return (
                  <li
                    key={module.key}
                    className={cn(
                      CARD,
                      "relative flex flex-col gap-1.5 p-4.5",
                      HIGHLIGHT.has(module.key) && "sm:col-span-2",
                      module.key === "getpack_jobs" && "bg-primary-subtle/50",
                      module.key === "accounting" && "bg-instant-subtle/40",
                    )}
                  >
                    <span
                      className={cn(
                        "rounded-control grid size-9.5 place-items-center",
                        module.key === "getpack_jobs"
                          ? "bg-primary-subtle text-primary"
                          : "bg-instant-subtle text-instant-subtle-fg",
                      )}
                    >
                      <Icon name={MODULE_ICONS[module.key]!} size={20} aria-hidden="true" />
                    </span>
                    <b className="mt-1 text-base font-semibold">{t(`modules.items.${module.key}.title`)}</b>
                    <p className="text-muted text-[13.5px]">{t(`modules.items.${module.key}.body`)}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="factory-floor" className={SECTION}>
          <div className="grid items-center gap-8 xl:grid-cols-[minmax(0,1fr)_18.75rem]">
            <div>
              <SectionHead id="factory-floor" title={t("floor.title")} lead={t("floor.lead")} />
              <ul className="flex flex-col gap-3">
                {FLOOR.map((point) => (
                  <li
                    key={point.key}
                    className="text-muted grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2.5 text-[14.5px]"
                  >
                    <Icon name={point.icon} size={22} aria-hidden="true" className="text-primary" />
                    <span>
                      <b className="text-fg block font-semibold">{t(`floor.points.${point.key}.title`)}</b>
                      {t(`floor.points.${point.key}.body`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <OperatorPhone />
          </div>
        </section>

        <section aria-labelledby="factory-compare" className={SECTION}>
          <SectionHead id="factory-compare" title={t("compare.title")} />
          {/* Scrolls on a phone (pack Phase 3 item 5); `relative` keeps the sr-only caption inside the scroller. */}
          <div
            className="border-border rounded-panel relative overflow-x-auto border"
            tabIndex={0}
            aria-labelledby="factory-compare"
          >
            <table className="bg-surface w-full min-w-[35rem] border-collapse text-sm">
              <caption className="sr-only">{t("compare.caption")}</caption>
              <thead>
                <tr className="bg-bg-subtle">
                  <td className="border-border border-b p-3.5" />
                  <th scope="col" className="border-border border-b p-3.5 text-left font-semibold">
                    {t("compare.cols.excel")}
                  </th>
                  <th scope="col" className="border-border border-b p-3.5 text-left font-semibold">
                    {t("compare.cols.erp")}
                  </th>
                  <th scope="col" className="border-border bg-instant-subtle/50 border-b p-3.5 text-left font-semibold">
                    {t("compare.cols.us")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, index) => {
                  const last = index === ROWS.length - 1 ? "" : "border-b";
                  return (
                    <tr key={row}>
                      <th scope="row" className={cn("border-border p-3.5 text-left align-top font-semibold", last)}>
                        {t(`compare.rows.${row}.label`)}
                      </th>
                      <td className={cn("border-border text-muted p-3.5 align-top", last)}>
                        {t(`compare.rows.${row}.excel`)}
                      </td>
                      <td className={cn("border-border text-muted p-3.5 align-top", last)}>
                        {t(`compare.rows.${row}.erp`)}
                      </td>
                      <td className={cn("border-border bg-instant-subtle/30 p-3.5 align-top font-semibold", last)}>
                        {t(`compare.rows.${row}.us`)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="factory-tiers" className={SECTION}>
          <SectionHead id="factory-tiers" title={t("tiers.title")} lead={t("tiers.lead")} />
          <ol className="grid gap-3 xl:grid-cols-3">
            {TIERS.map((tier, index) => (
              <li key={tier} className={cn(CARD, "flex flex-col gap-1.5 p-4.5")}>
                <span className="text-muted text-xs tabular-nums">{t("tiers.level", { n: index + 1 })}</span>
                <b className="text-[17px] font-semibold">{t(`tiers.items.${tier}.title`)}</b>
                <p className="text-muted text-[13.5px]">{t(`tiers.items.${tier}.body`)}</p>
              </li>
            ))}
          </ol>
          <h3 className="mt-5 mb-2.5 text-[15px] font-semibold">{t("tiers.sourcesTitle")}</h3>
          <ul className="grid gap-3 md:grid-cols-2">
            {SOURCES.map((source) => (
              <li key={source} className="border-border bg-bg-subtle rounded-card flex gap-3 border p-4">
                <Icon
                  name={source === "rate_card" ? "spreadsheet" : "tag"}
                  size={20}
                  aria-hidden="true"
                  className="text-primary mt-0.5 shrink-0"
                />
                <span>
                  <b className="block font-semibold">{t(`tiers.sources.${source}.title`)}</b>
                  <span className="text-muted text-[13.5px]">{t(`tiers.sources.${source}.body`)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className={cn(HOME_WRAP, "scroll-mt-24 pt-16")} id="apply">
        {/* The application on the pale brand tint (no dark block); the form keeps its white fields. */}
        <section
          aria-labelledby="factory-apply-title"
          className="bg-primary-subtle text-fg rounded-panel grid gap-6 overflow-hidden p-5 sm:p-9 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
        >
          <div>
            <h2
              id="factory-apply-title"
              className="text-[clamp(1.625rem,3vw,2.25rem)] leading-[1.15] font-bold tracking-[-0.02em]"
            >
              {t("applySection.title")}
            </h2>
            <p className="text-muted mt-2.5">{t("applySection.lead")}</p>
            <ol aria-label={t("applySection.stepsLabel")} className="mt-5 flex flex-col gap-2.5 text-[14.5px]">
              {(["apply", "agreement", "start"] as const).map((step, index) => (
                <li key={step} className="flex items-center gap-2.5">
                  <span className="bg-primary text-primary-fg grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-bold tabular-nums">
                    {index + 1}
                  </span>
                  {t(`applySection.steps.${step}`)}
                </li>
              ))}
            </ol>
            <ul className="text-muted mt-5 flex flex-col gap-2.5 text-[14.5px]">
              <li className="flex gap-2.5">
                <Icon name="shield-check" size={18} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
                {t("applySection.confidential")}
              </li>
              <li className="flex gap-2.5">
                <Icon name="check" size={18} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
                {t("applySection.assess")}
              </li>
            </ul>
            <div className="border-border mt-6 border-t pt-5">
              <h3 className="text-[15px] font-semibold">{t("applySection.termsTitle")}</h3>
              <ul className="text-muted mt-2.5 flex list-disc flex-col gap-1.5 pl-5 text-[14px]">
                {TERMS.map((term) => (
                  <li key={term}>{t(`applySection.terms.${term}`)}</li>
                ))}
              </ul>
              <p className="text-muted mt-2.5 text-[13px]">{t("applySection.termsNote")}</p>
            </div>
          </div>
          <FactoryApplyForm
            capabilities={types.map((type) => ({ value: type.code, label: pick(locale, type.nameTh, type.nameEn) }))}
            provinces={provinces.map((province) => ({
              value: province.code,
              label: pick(locale, province.nameTh, province.nameEn),
            }))}
          />
        </section>
      </div>

      <div className={cn(HOME_WRAP, "pb-16 md:pb-20")}>
        <section aria-labelledby="factory-faq" className={SECTION}>
          <SectionHead id="factory-faq" title={t("faq.title")} />
          <div className="grid gap-x-8 md:grid-cols-2">
            {faq.map((item, index) => (
              <details key={item.key} open={index === 0} className="border-border group border-b">
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
      </div>
    </div>
  );
}
