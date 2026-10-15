import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getSupportChannels } from "@/features/customer/catalog/api.server";
import { pageContext } from "@/features/customer/content/page-meta.server";
import { ContactForm } from "@/features/customer/help/ContactForm";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { organizationSchema, webPageSchema } from "@/lib/seo";
import { Button } from "@/ui/components/Button";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help.contact");
  return { title: t("title"), description: t("intro") };
}

/** Contact (F3 3.7): the channels the API lists, and a message that becomes a ticket. */
export default async function Page() {
  const [t, channels] = await Promise.all([getTranslations("help.contact"), getSupportChannels()]);
  const page = await pageContext("/contact", t("title"));
  // The contact page as an entity, with the channels the API lists as the organisation's contact
  // points — a phone or an email appears here only when the API has one (SEO pass).
  const contactPoints = channels
    ? [
        ...(channels.phone ? [{ "@type": "ContactPoint", contactType: "customer service", telephone: channels.phone }] : []),
        ...(channels.email ? [{ "@type": "ContactPoint", contactType: "customer service", email: channels.email }] : []),
      ]
    : [];
  return (
    <div className="max-w-content mx-auto grid w-full gap-10 px-5 py-10 md:px-8 md:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <JsonLd data={page.breadcrumb} />
      <JsonLd
        data={{
          ...webPageSchema({ type: "ContactPage", name: t("title"), description: t("intro"), url: page.url, locale: page.language }),
          mainEntity: {
            ...organizationSchema(page.origin),
            ...(contactPoints.length > 0 ? { contactPoint: contactPoints } : {}),
            ...(channels?.hours ? { openingHours: channels.hours } : {}),
          },
        }}
      />
      <header className="flex flex-col gap-4">
        <h1 className="text-4xl leading-tight md:text-5xl">{t("title")}</h1>
        <p className="text-muted text-lg leading-relaxed">{t("intro")}</p>
        {/* LINE first, as the channel the team answers fastest (UX audit, /contact). */}
        {channels?.lineOaId ? (
          <Button asChild size="lg" className="self-start" iconStart="chat">
            <a
              href={`https://line.me/R/ti/p/${encodeURIComponent(channels.lineOaId)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("lineCta")}
            </a>
          </Button>
        ) : null}
        {channels ? (
          <DescriptionList
            items={[
              ...(channels.lineOaId
                ? [
                    {
                      term: t("line"),
                      description: (
                        <a
                          href={`https://line.me/R/ti/p/${encodeURIComponent(channels.lineOaId)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-4"
                        >
                          {channels.lineOaId}
                        </a>
                      ),
                    },
                  ]
                : []),
              ...(channels.phone
                ? [
                    {
                      term: t("phoneLabel"),
                      description: (
                        <a
                          href={`tel:${channels.phone.replace(/\D/g, "")}`}
                          className="text-primary underline underline-offset-4"
                        >
                          {channels.phone}
                        </a>
                      ),
                    },
                  ]
                : []),
              ...(channels.email
                ? [
                    {
                      term: t("emailLabel"),
                      description: (
                        <a href={`mailto:${channels.email}`} className="text-primary underline underline-offset-4">
                          {channels.email}
                        </a>
                      ),
                    },
                  ]
                : []),
              ...(channels.hours ? [{ term: t("hours"), description: channels.hours }] : []),
            ]}
          />
        ) : null}
        {/* The answers a customer can reach without waiting for anyone. */}
        <nav aria-label={t("selfServe")} className="mt-4">
          <p className="text-muted mb-2 text-sm font-semibold">{t("selfServe")}</p>
          <ul className="border-border bg-surface divide-border divide-y rounded-card border">
            {(
              [
                ["track", "/track", "truck"],
                ["help", "/help", "help"],
                ["faq", "/faq", "chat"],
              ] as const
            ).map(([key, href, icon]) => (
              <li key={key}>
                <Link href={href} className="group hover:bg-surface-subtle flex items-center gap-3.5 px-4 py-3.5">
                  <span className="bg-primary-subtle text-primary grid size-10 shrink-0 place-items-center rounded-xl">
                    <Icon name={icon} size={18} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t(`shortcut.${key}.title`)}</span>
                    <span className="text-muted block text-sm">{t(`shortcut.${key}.body`)}</span>
                  </span>
                  <Icon
                    name="arrow-right"
                    size={16}
                    aria-hidden="true"
                    className="text-muted duration-fast transition-transform motion-safe:group-hover:translate-x-1"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <section aria-labelledby="contact-form" className="border-border bg-surface rounded-card border p-6">
        <h2 id="contact-form" className="mb-4 text-lg font-semibold">
          {t("formTitle")}
        </h2>
        <ContactForm />
      </section>
    </div>
  );
}
