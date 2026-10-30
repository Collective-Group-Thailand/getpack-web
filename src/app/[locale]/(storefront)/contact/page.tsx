import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import {
  getContactOptions,
  getProductTypes,
  getProvinces,
  getPublicConfig,
  getSupportChannels,
} from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { schemaOpeningHours } from "@/features/customer/catalog/support-hours";
import { pageContext } from "@/features/customer/content/page-meta.server";
import { ContactCentre } from "@/features/customer/help/contact/ContactCentre";
import { ContactSide } from "@/features/customer/help/contact/ContactSide";
import { INTENTS, type Intent } from "@/features/customer/help/contact/intents";
import { TeamStatus } from "@/features/customer/help/contact/TeamStatus";
import { TrackBox } from "@/features/customer/help/contact/TrackBox";
import { realIssuer } from "@/features/customer/help/contact/issuer";
import { HOME_WRAP } from "@/features/customer/home/parts";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { readAccessToken } from "@/lib/auth/session";
import { organizationSchema, webPageSchema } from "@/lib/seo";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help.contact");
  return { title: t("metaTitle"), description: t("intro") };
}

/** Old links (`?topic=partner`, `?topic=delivery`…) open on their intent. */
const TOPIC_ALIASES: Record<string, Intent> = { partner: "partnership", file: "artwork", shipping: "delivery" };
const MORE: { key: "business" | "factory" | "help"; href: string; icon: IconName }[] = [
  { key: "business", href: "/business", icon: "building" },
  { key: "factory", href: "/partner-with-us", icon: "factory" },
  { key: "help", href: "/help", icon: "help" },
];

/**
 * Contact (business pack Phase 2, C10): "มีอะไรให้ช่วยครับ", whether the team answers now (the API, Asia/Bangkok),
 * one tracking box for orders and requests, 8 intents with their common answers and a form that follows the intent
 * (a contact ticket routed by intent, D-458), the LINE OA, the other channels and the company's legal details — all
 * from the contact config, a row without a value is not drawn — and the ways that may fit better.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const locale = await getLocale();
  const [t, tPay, channels, config, options, types, provinces, { topic }, jar] = await Promise.all([
    getTranslations("help.contact"),
    getTranslations("business.landing.credit.method"),
    getSupportChannels(),
    getPublicConfig(),
    getContactOptions(),
    getProductTypes().catch(() => []),
    getProvinces(),
    searchParams,
    cookies(),
  ]);
  const signedIn = Boolean(readAccessToken(jar));
  const wanted = topic ? (TOPIC_ALIASES[topic] ?? topic) : "order";
  const initialIntent: Intent = (INTENTS as readonly string[]).includes(wanted) ? (wanted as Intent) : "order";
  const openingHours = schemaOpeningHours(config?.supportHours);
  const page = await pageContext("/contact", t("crumb"));
  // The entity settings, or nothing while they are still the seed's placeholders (no fake legal data on the page).
  const entity = realIssuer(config?.issuer);
  const issuer = locale === "en" ? (entity?.legalNameEn ?? entity?.legalNameTh ?? null) : (entity?.legalNameTh ?? null);
  const contactPoints = channels
    ? [
        ...(channels.phone
          ? [{ "@type": "ContactPoint", contactType: "customer service", telephone: channels.phone }]
          : []),
        ...(channels.email
          ? [{ "@type": "ContactPoint", contactType: "customer service", email: channels.email }]
          : []),
      ]
    : [];
  const topicLabel = Object.fromEntries(INTENTS.map((value) => [value, t(`intents.${value}.title`)]));
  const methods = (config?.paymentMethods ?? []).map((method) => tPay(method));

  return (
    <div className={cn(HOME_WRAP, "pb-16 md:pb-20")}>
      <JsonLd data={page.breadcrumb} />
      <JsonLd
        data={{
          ...webPageSchema({
            type: "ContactPage",
            name: t("title"),
            description: t("intro"),
            url: page.url,
            locale: page.language,
          }),
          mainEntity: {
            ...organizationSchema(page.origin),
            ...(issuer ? { legalName: issuer } : {}),
            ...(contactPoints.length > 0 ? { contactPoint: contactPoints } : {}),
            ...(openingHours ? { openingHours } : {}),
          },
        }}
      />
      <header className="pt-6 md:pt-8">
        <Breadcrumbs
          label={page.crumbLabel}
          items={page.crumbs.map((crumb) => ({ label: crumb.name, href: crumb.url }))}
        />
        <div className="mt-3 grid items-end gap-6 xl:grid-cols-[minmax(0,1fr)_26.25rem]">
          <div>
            <h1 className="text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance md:text-[2.25rem]">
              {t("title")}
            </h1>
            <p className="text-muted mt-2.5 max-w-[60ch]">{t("intro")}</p>
            <TrackBox signedIn={signedIn} topicLabel={topicLabel} />
          </div>
          <TeamStatus status={options?.teamStatus ?? null} hours={channels?.hours ?? null} />
        </div>
      </header>

      <ContactCentre
        initialIntent={initialIntent}
        lineAvailable={Boolean(channels?.lineOaId)}
        options={options}
        facts={{
          claimWindowDays: config?.claimWindowDays ?? null,
          priceLockDays: config?.priceLockDays ?? null,
          methods,
          issuer,
        }}
        capabilities={types.map((type) => ({ value: type.code, label: pick(locale, type.nameTh, type.nameEn) }))}
        provinces={provinces.map((province) => ({
          value: province.code,
          label: pick(locale, province.nameTh, province.nameEn),
        }))}
        side={<ContactSide channels={channels} issuer={entity} />}
      />

      <section aria-labelledby="contact-more" className="pt-14">
        <h2 id="contact-more" className="mb-5 text-[1.625rem] leading-tight font-semibold">
          {t("more.title")}
        </h2>
        <ul className="grid gap-3 md:grid-cols-3">
          {MORE.map((card) => (
            <li key={card.key}>
              <Link
                href={card.href}
                className="group border-border bg-surface rounded-panel hover:border-primary flex h-full flex-col gap-1.5 border p-5 transition-colors"
              >
                <Icon name={card.icon} size={22} aria-hidden="true" className="text-primary" />
                <b className="mt-1 text-[17px] font-semibold">{t(`more.${card.key}.title`)}</b>
                <span className="text-muted text-sm">{t(`more.${card.key}.body`)}</span>
                <span className="text-primary mt-1 inline-flex items-center gap-1.5 text-sm font-semibold">
                  {t(`more.${card.key}.cta`)}
                  <Icon
                    name="arrow-right"
                    size={15}
                    aria-hidden="true"
                    className="duration-fast transition-transform motion-safe:group-hover:translate-x-1"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
