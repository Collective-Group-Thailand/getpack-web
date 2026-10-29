import { getTranslations } from "next-intl/server";

import type { PublicConfig, StyleLibrarySettings } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { storeDocumentHref, storeImageSrc } from "@/features/customer/catalog/images";
import { Icon, type IconName } from "@/ui/icons";

type Trust = StyleLibrarySettings["trust"];
type Tolerances = PublicConfig["tolerances"];

/** C12 (D-460): the "how we work" steps — what the system and the team do on every order, in order. */
export const WORK_STEPS = ["fileCheck", "approval", "production", "quality", "delivery"] as const;

/** "5.00" → "5", "1.50" → "1.5": the API's decimal string without trailing zeros (display only, no arithmetic). */
const plain = (value: string) => (value.includes(".") ? value.replace(/\.?0+$/, "") : value);

/** True when staff entered anything for the trust section (the tax-invoice tile shows regardless, C0b). */
export const hasTrust = (trust: Trust | null | undefined): trust is Trust =>
  !!trust &&
  (trust.certifications.length > 0 ||
    trust.foodGrade.length > 0 ||
    trust.productionPhotos.length > 0 ||
    trust.customerLogos.length > 0 ||
    trust.taxInvoiceNote !== null);

/**
 * "ความน่าเชื่อถือ" (styles redesign Phase 2 §6, C0): certificates, food-grade documents, production
 * photos, the tax-invoice note and permitted customer logos — only what staff entered in
 * `store.styleLibrary.getSettings` (D-448; expired certificates already left out by the API); each part is hidden when empty, and the section when all are.
 * Production photos are labelled "รูปงานจริงระหว่างผลิต" (GLOBAL-RULES §1: product and process only).
 * C12 (DECISIONS-STAGE-A §17.3, D-460): an approved "how we work" block — ตรวจไฟล์ → อนุมัติแบบ → ผลิต → ตรวจคุณภาพ →
 * จัดส่ง — with the default tolerances from the settings; no certificates, photos or logos are added by it.
 */
export async function TrustBlock({
  trust: entered,
  locale,
  tolerances,
}: {
  trust: Trust | null | undefined;
  locale: string;
  /** The default tolerances from the settings (`store.publicConfig.get`); a part without a value is left out. */
  tolerances?: Tolerances | null;
}) {
  const t = await getTranslations("styles.library");
  // C0b (DECISIONS-STAGE-A §9.4c): the tax-invoice note is backed by D-010 (getpack issues every customer tax
  // invoice for the full amount) and D-125 (a tax invoice per order, per branch) — shown even before staff enter
  // their own wording; every other part stays empty until the business provides it (TRUST-CONTENT-CHECKLIST.md).
  const trust: Trust = entered ?? {
    certifications: [],
    foodGrade: [],
    productionPhotos: [],
    customerLogos: [],
    taxInvoiceNote: null,
  };
  const tiles: { icon: IconName; title: string; body: React.ReactNode; key: string }[] = [];
  if (trust.certifications.length)
    tiles.push({
      key: "cert",
      icon: "shield",
      title: t("trustCertifications"),
      body: (
        <ul className="flex flex-col gap-1">
          {trust.certifications.map((c, i) => (
            <li key={i}>
              {pick(locale, c.title.th, c.title.en)}
              {c.number ? (
                <span className="tabular-nums"> · {t("trustCertificateNumber", { number: c.number })}</span>
              ) : null}
              {c.issuer ? <span> · {t("trustCertificateIssuer", { issuer: c.issuer })}</span> : null}
              {storeDocumentHref(c.documentUrl) ? (
                <>
                  {" "}
                  <a
                    href={storeDocumentHref(c.documentUrl)!}
                    className="text-primary underline underline-offset-2"
                    rel="noopener"
                  >
                    {t("trustDocument")}
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ),
    });
  if (trust.foodGrade.length)
    tiles.push({
      key: "food",
      icon: "leaf",
      title: t("trustFoodGrade"),
      body: (
        <ul className="flex flex-col gap-1">
          {trust.foodGrade.map((f, i) => (
            <li key={i}>
              {pick(locale, f.title.th, f.title.en)}
              {storeDocumentHref(f.documentUrl) ? (
                <>
                  {" "}
                  <a
                    href={storeDocumentHref(f.documentUrl)!}
                    className="text-primary underline underline-offset-2"
                    rel="noopener"
                  >
                    {t("trustDocument")}
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ),
    });
  tiles.push({
    key: "tax",
    icon: "receipt",
    title: t("trustTaxInvoice"),
    body: trust.taxInvoiceNote
      ? pick(locale, trust.taxInvoiceNote.th, trust.taxInvoiceNote.en)
      : t("trustTaxInvoiceDefault"),
  });

  // C12 (D-460): tolerance figures only from the API; each one is left out while its setting has no value.
  const toleranceParts = [
    tolerances?.quantityPct ? t("work.toleranceQuantity", { pct: plain(tolerances.quantityPct) }) : null,
    tolerances?.sizeMmMin && tolerances.sizeMmMax
      ? tolerances.sizeMmMin === tolerances.sizeMmMax
        ? t("work.toleranceSize", { mm: plain(tolerances.sizeMmMin) })
        : t("work.toleranceSizeRange", { min: plain(tolerances.sizeMmMin), max: plain(tolerances.sizeMmMax) })
      : null,
    tolerances?.colourDeltaE
      ? tolerances.colourDeltaEFlexo && tolerances.colourDeltaEFlexo !== tolerances.colourDeltaE
        ? t("work.toleranceColourFlexo", {
            de: plain(tolerances.colourDeltaE),
            flexo: plain(tolerances.colourDeltaEFlexo),
          })
        : t("work.toleranceColour", { de: plain(tolerances.colourDeltaE) })
      : null,
  ].filter((part): part is string => part !== null);

  return (
    <section aria-labelledby="library-trust" className="border-border rounded-card mt-10 border p-5" data-trust="">
      <h2 id="library-trust" className="mb-4 text-lg font-semibold">
        {t("trustTitle")}
      </h2>
      {tiles.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.key} className="flex gap-3">
              <Icon name={tile.icon} size={22} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
              <div className="min-w-0 text-sm">
                <b className="block font-semibold">{tile.title}</b>
                <div className="text-muted">{tile.body}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="border-border mt-6 border-t pt-5" data-work="">
        <h3 className="mb-3 text-[0.9375rem] font-semibold">{t("work.title")}</h3>
        <ol className="m-0 grid list-none gap-x-6 gap-y-4 p-0 sm:grid-cols-2 lg:grid-cols-5">
          {WORK_STEPS.map((step, index) => (
            <li key={step} className="text-sm">
              <span className="text-primary block text-xs font-semibold tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <b className="mt-0.5 block font-semibold">{t(`work.steps.${step}.title`)}</b>
              <span className="text-muted mt-0.5 block">{t(`work.steps.${step}.body`)}</span>
            </li>
          ))}
        </ol>
        {toleranceParts.length ? (
          <p className="text-muted mt-4 mb-0 text-[0.8125rem]">
            <b className="text-fg font-semibold">{t("work.toleranceLabel")}</b> {toleranceParts.join(" · ")}{" "}
            {t("work.toleranceNote")}
          </p>
        ) : null}
      </div>
      {trust.productionPhotos.length ? (
        <figure className="mt-5">
          <figcaption className="mb-2 text-sm font-semibold">{t("trustPhotos")}</figcaption>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {trust.productionPhotos.map((photo, i) => (
              <li key={i} className="bg-bg-subtle rounded-control aspect-[4/3] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element -- the API's public image, through the BFF */}
                <img
                  src={storeImageSrc(photo.url, "thumb") ?? photo.url}
                  alt={pick(locale, photo.alt.th, photo.alt.en)}
                  width={400}
                  height={300}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </li>
            ))}
          </ul>
        </figure>
      ) : null}
      {trust.customerLogos.length ? (
        <div className="mt-5">
          <p className="text-muted mb-2 text-sm">{t("trustLogos")}</p>
          <ul className="flex flex-wrap items-center gap-6">
            {trust.customerLogos.map((logo) => (
              <li key={logo.name}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a permitted customer logo from the API */}
                <img
                  src={storeImageSrc(logo.logoUrl) ?? logo.logoUrl}
                  alt={logo.name}
                  height={32}
                  className="h-8 w-auto"
                  loading="lazy"
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
