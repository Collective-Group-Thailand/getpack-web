import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getSupportChannels } from "@/features/customer/catalog/api.server";
import { ContactForm } from "@/features/customer/help/ContactForm";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help.contact");
  return { title: t("title"), description: t("intro") };
}

/** Contact (F3 3.7): the channels the API lists, and a message that becomes a ticket. */
export default async function Page() {
  const [t, channels] = await Promise.all([getTranslations("help.contact"), getSupportChannels()]);
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-10 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <header className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("intro")}</p>
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
      </header>
      <section aria-labelledby="contact-form">
        <h2 id="contact-form" className="mb-4 text-lg font-semibold">
          {t("formTitle")}
        </h2>
        <ContactForm />
      </section>
    </div>
  );
}
