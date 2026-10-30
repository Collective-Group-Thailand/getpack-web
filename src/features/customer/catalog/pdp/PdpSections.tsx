import { getLocale, getTranslations } from "next-intl/server";

import type { Configurator } from "@/features/customer/configurator/model";
import { stepsOf, type StepKey } from "@/features/customer/configurator/state";
import { HubCard } from "@/features/customer/products/HubCard";
import type { HubItem } from "@/features/customer/products/hub";
import { HubSection } from "@/features/customer/products/HubSections";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { DisclosureList } from "@/ui/components/DisclosureList";

import { pick } from "../localize";
import { PdpToleranceAnswer } from "./PdpToleranceAnswer";
import { hasStandardSizes, printChoicesOf, startOf } from "./model";

/**
 * The print notes under the materials table (pdp redesign item 7): one card per print method this
 * product offers outside — spot colours (with the inks it lists) and CMYK. The sentences are the
 * content file's (`catalog.pdp.print`, for the business team to approve); the methods are the API's.
 */
export async function PdpPrintNotes({ configurator }: { configurator: Configurator }) {
  const [t, locale] = await Promise.all([getTranslations("catalog.pdp.print"), getLocale()]);
  const choices = printChoicesOf(configurator, startOf(configurator));
  const inks = choices.flatMap((choice) =>
    choice.label.kind === "ink" ? [pick(locale, choice.label.option.nameTh, choice.label.option.nameEn)] : [],
  );
  const spot = inks.length > 0 || choices.some((choice) => choice.label.kind === "spot");
  const cmyk = choices.some((choice) => choice.label.kind === "cmyk");
  if (!spot && !cmyk) return null;
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
      {spot ? (
        <div className="border-border bg-surface rounded-card border p-5">
          <h3 className="m-0 mb-2 text-[1.0625rem] font-semibold">{t("spot.title")}</h3>
          <p className="text-muted m-0 text-sm">{t("spot.body")}</p>
          {inks.length > 0 ? (
            <p className="text-muted m-0 mt-1.5 text-sm">{t("spot.inks", { inks: inks.join(" · ") })}</p>
          ) : null}
        </div>
      ) : null}
      {cmyk ? (
        <div className="border-border bg-surface rounded-card border p-5">
          <h3 className="m-0 mb-2 text-[1.0625rem] font-semibold">{t("cmyk.title")}</h3>
          <p className="text-muted m-0 text-sm">{t("cmyk.body")}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * "ขั้นตอนสั่งซื้อ" (pdp redesign item 9): the configurator's own steps for this product (the Structure
 * Advisor's optional step left out), in its order and with its names; the steps this page already sets
 * read "ตั้งจากหน้านี้".
 */
export async function PdpOrderFlow({
  configurator,
  collapsible = false,
}: {
  configurator: Configurator;
  /** Folded to its heading among the page's reference rows (`HubSectionStack`). */
  collapsible?: boolean;
}) {
  const [t, tSteps] = await Promise.all([getTranslations("catalog.pdp.flow"), getTranslations("configurator.steps")]);
  const steps = stepsOf(configurator).filter((step) => step !== "logistics");
  const setHere: Partial<Record<StepKey, boolean>> = {
    size: hasStandardSizes(configurator),
    material: true,
    printing: printChoicesOf(configurator, startOf(configurator)).length > 1,
    quantity: true,
  };
  const noteOf = (step: StepKey) => {
    if (setHere[step]) return t("fromPage");
    if (step === "delivery") return t("delivery");
    if (step === "design") return t("design");
    if (step === "summary") return t("summary");
    return t("inConfigurator");
  };
  return (
    <HubSection id="how" title={t("title")} lede={t("lede", { count: steps.length })} collapsible={collapsible}>
      <ol
        className="border-border bg-surface rounded-card m-0 grid list-none grid-cols-2 overflow-hidden border p-0 min-[1040px]:grid-cols-[repeat(var(--flow-steps),minmax(0,1fr))]"
        style={{ "--flow-steps": steps.length } as React.CSSProperties}
      >
        {steps.map((step, index) => (
          <li
            key={step}
            className="border-border flex flex-col gap-1.5 border-b p-4 max-[1039px]:odd:border-e min-[1040px]:border-e min-[1040px]:border-b-0 min-[1040px]:last:border-e-0"
          >
            <span className="text-primary text-xs font-semibold tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
            <b className="text-sm font-semibold">{tSteps(step)}</b>
            <small className="text-muted text-xs">{noteOf(step)}</small>
          </li>
        ))}
      </ol>
    </HubSection>
  );
}

export interface FaqEntry {
  question: string;
  /** The answer as text — what the FAQPage JSON-LD carries. */
  answer: string;
  /** What the page shows instead, when the answer depends on live data (the tolerance, §14.9). */
  display?: React.ReactNode;
}

/**
 * The product page's questions (pdp redesign item 10): the content file's answers (`catalog.pdp.faq`,
 * figures from the API — the quote's validity, the lead time — or none), then the questions staff wrote
 * for this product in the back office. The same list feeds the FAQPage JSON-LD.
 */
export async function pdpFaqEntries({
  configurator,
  leadTime,
  productFaqs,
}: {
  configurator: Configurator | null;
  leadTime: string | null;
  productFaqs: readonly FaqEntry[];
}): Promise<FaqEntry[]> {
  if (!configurator) return [...productFaqs];
  const t = await getTranslations("catalog.pdp.faq.items");
  const offered = configurator.design.options;
  const artwork = [
    t("artwork.a"),
    offered.includes("online_designer") ? t("artwork.studio") : null,
    offered.includes("hired_design") ? t("artwork.hired") : null,
    offered.includes("own_file") ? t("artwork.ownFile") : null,
  ]
    .filter(Boolean)
    .join(" ");
  const own: FaqEntry[] = [
    { question: t("included.q"), answer: t("included.a") },
    ...(hasStandardSizes(configurator) ? [{ question: t("insideOutside.q"), answer: t("insideOutside.a") }] : []),
    // §14.9 (owner 2026-10-28 14:36): the API's tolerance figures (as the buy box), never a fixed ±5 %; the
    // structured data keeps the figure-free answer, which is true for every calculation.
    { question: t("tolerance.q"), answer: t("tolerance.aNoFigure"), display: <PdpToleranceAnswer /> },
    ...(configurator.quoteValidityDays
      ? [{ question: t("priceLock.q"), answer: t("priceLock.a", { days: configurator.quoteValidityDays }) }]
      : []),
    ...(offered.length > 0 ? [{ question: t("artwork.q"), answer: artwork }] : []),
    ...(leadTime ? [{ question: t("leadTime.q"), answer: t("leadTime.a", { lead: leadTime }) }] : []),
  ];
  return [...own, ...productFaqs];
}

export async function PdpFaq({ entries }: { entries: readonly FaqEntry[] }) {
  const t = await getTranslations("catalog.pdp.faq");
  if (entries.length === 0) return null;
  const items = entries.map((entry, index) => ({
    id: `pdp-faq-${index}`,
    summary: entry.question,
    content: entry.display ?? entry.answer,
  }));
  const half = Math.ceil(items.length / 2);
  return (
    <HubSection id="faq" title={t("title")}>
      <div className="grid grid-cols-1 gap-x-8 min-[1040px]:grid-cols-2">
        <DisclosureList items={items.slice(0, half)} headingLevel="h3" />
        <DisclosureList items={items.slice(half)} headingLevel="h3" />
      </div>
    </HubSection>
  );
}

/** "สินค้าอื่นในหมวด…" (pdp redesign item 10): up to four other products of the same category, as hub cards. */
export async function PdpRelated({
  items,
  categoryName,
  categoryHref,
}: {
  items: readonly HubItem[];
  categoryName: string | null;
  categoryHref: string | null;
}) {
  const t = await getTranslations("catalog.pdp.related");
  if (items.length === 0) return null;
  return (
    <HubSection
      id="related"
      title={categoryName ? t("title", { category: categoryName }) : t("titleAny")}
      aside={
        categoryHref ? (
          <Button asChild variant="secondary">
            <Link href={categoryHref}>{t("all")}</Link>
          </Button>
        ) : undefined
      }
    >
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <HubCard key={`${item.kind}:${item.key}`} item={item} categoryName={categoryName} />
        ))}
      </ul>
    </HubSection>
  );
}
