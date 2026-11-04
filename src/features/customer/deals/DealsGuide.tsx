import { getTranslations } from "next-intl/server";

import { DisclosureList } from "@/ui/components/DisclosureList";

/** The FAQ entries of `/deals`, shared by the block and its `FAQPage` markup so the two never differ. */
export async function dealsFaq(maxCodes: number | null) {
  const t = await getTranslations("deals.faq");
  return [
    {
      id: "combine",
      question: t("combine.q"),
      answer: maxCodes ? t("combine.a", { max: maxCodes }) : t("combine.aNoMax"),
    },
    { id: "wallet", question: t("wallet.q"), answer: t("wallet.a") },
    { id: "how", question: t("how.q"), answer: t("how.a") },
    { id: "auto", question: t("auto.q"), answer: t("auto.a") },
  ];
}

/**
 * "ใช้คูปองอย่างไร" 01–03 beside the FAQ (prototype `p15-deals.html`): 5/12 and 7/12 from 1024 px, stacked below,
 * a hairline above. The steps say only what the system does today.
 */
export async function DealsGuide({
  faq,
  maxCodes,
}: {
  faq: Awaited<ReturnType<typeof dealsFaq>>;
  maxCodes: number | null;
}) {
  const t = await getTranslations("deals");
  const steps = [
    { n: "01", title: t("howto.s1.title"), body: t("howto.s1.body") },
    { n: "02", title: t("howto.s2.title"), body: t("howto.s2.body") },
    {
      n: "03",
      title: t("howto.s3.title"),
      body: maxCodes ? t("howto.s3.body", { max: maxCodes }) : t("howto.s3.bodyNoMax"),
    },
  ];
  return (
    <div className="border-border mt-16 grid gap-10 border-t pt-10 lg:mt-18 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
      <section aria-labelledby="deals-howto">
        <h2 id="deals-howto" className="m-0 text-[1.375rem] leading-snug font-semibold">
          {t("howto.title")}
        </h2>
        <ol className="m-0 mt-5 flex list-none flex-col gap-5 p-0">
          {steps.map((step) => (
            <li key={step.n} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3.5">
              <span
                aria-hidden="true"
                className="bg-primary-subtle text-primary-subtle-fg grid h-7.5 place-items-center rounded-lg text-sm font-semibold tabular-nums"
              >
                {step.n}
              </span>
              <div>
                <p className="m-0 text-[0.96875rem] font-semibold">{step.title}</p>
                <p className="text-muted m-0 mt-0.5 text-sm">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="deals-faq">
        <h2 id="deals-faq" className="m-0 text-[1.375rem] leading-snug font-semibold">
          {t("faq.title")}
        </h2>
        <DisclosureList
          className="mt-4"
          headingLevel="h3"
          items={faq.map((entry, index) => ({
            id: `faq-${entry.id}`,
            summary: entry.question,
            content: entry.answer,
            defaultOpen: index === 0,
          }))}
        />
      </section>
    </div>
  );
}
