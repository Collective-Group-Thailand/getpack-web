import { getLocale, getTranslations } from "next-intl/server";

import type { Configurator } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { DisclosureList } from "@/ui/components/DisclosureList";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { FAQ_KEYS, faqAnswer } from "./content";

/** One section of the hub: an anchor target under the sticky bars, with its heading and lede. */
export function HubSection({
  id,
  title,
  lede,
  aside,
  children,
  className,
}: {
  id: string;
  title: string;
  lede?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-title`}
      className={cn("scroll-mt-[calc(var(--site-sticky-top)+4.5rem)] pt-14 outline-none", className)}
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id={`${id}-title`} className="text-2xl leading-tight font-semibold md:text-[1.625rem]">
            {title}
          </h2>
          {lede ? <p className="text-muted mt-1.5 max-w-[62ch] text-[0.90625rem]">{lede}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------------- ราคาคิดอย่างไร */

const FACTORS = ["size", "material", "print", "quantity"] as const;

/** Plain drawings of the four factors (prototype `.factor svg`), in the theme's own colours. */
function FactorFigure({ factor }: { factor: (typeof FACTORS)[number] }) {
  const common = { viewBox: "0 0 200 64", "aria-hidden": true, className: "mb-1.5 h-16 w-full" } as const;
  const plate = "var(--color-bg-subtle)";
  const line = "var(--color-border-strong)";
  const brand = "var(--color-primary)";
  const tint = "var(--color-primary-subtle)";
  switch (factor) {
    case "size":
      return (
        <svg {...common}>
          <rect x="14" y="30" width="34" height="26" rx="3" fill={plate} stroke={line} />
          <rect x="62" y="20" width="48" height="36" rx="3" fill={plate} stroke={line} />
          <rect x="124" y="6" width="64" height="50" rx="3" fill={tint} stroke={brand} />
        </svg>
      );
    case "material":
      return (
        <svg {...common}>
          <path d="M10 24h180M10 44h180" stroke={line} strokeWidth="3" />
          <path
            d="M10 34q7.5-10 15 0t15 0 15 0 15 0 15 0 15 0 15 0 15 0 15 0 15 0 15 0 15 0"
            fill="none"
            stroke={brand}
            strokeWidth="2.5"
          />
        </svg>
      );
    case "print":
      // Process inks are what this figure shows: cyan, magenta, yellow, black.
      return (
        <svg {...common}>
          <circle cx="40" cy="32" r="16" fill="#00A3E0" opacity=".8" />
          <circle cx="62" cy="32" r="16" fill="#E0007A" opacity=".75" />
          <circle cx="84" cy="32" r="16" fill="#F2D600" opacity=".8" />
          <circle cx="106" cy="32" r="16" fill="#1d1d1b" opacity=".8" />
          <rect x="134" y="16" width="52" height="32" rx="4" fill="none" stroke={line} strokeDasharray="4 3" />
        </svg>
      );
    case "quantity":
      return (
        <svg {...common}>
          <g fill={brand}>
            <rect x="12" y="6" width="22" height="52" rx="3" opacity=".35" />
            <rect x="44" y="20" width="22" height="38" rx="3" opacity=".5" />
            <rect x="76" y="30" width="22" height="28" rx="3" opacity=".65" />
            <rect x="108" y="37" width="22" height="21" rx="3" opacity=".8" />
            <rect x="140" y="41" width="22" height="17" rx="3" />
          </g>
          <path d="M8 58h184" stroke={line} />
        </svg>
      );
  }
}

/**
 * "ราคาคิดอย่างไร" (prompt item 9): four factor cards with simple figures, then what the price includes and
 * leaves out — draft content in `products.how` (BUSINESS-REVIEW, `content.ts`).
 */
export async function HowPricing() {
  const t = await getTranslations("products.how");
  const included: { key: string; yes: boolean }[] = [
    { key: "includes.vat", yes: true },
    { key: "includes.dieline", yes: true },
    { key: "includes.warranty", yes: true },
    { key: "excludes.shipping", yes: false },
  ];
  return (
    <HubSection id="how" title={t("title")} lede={t("lede")}>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FACTORS.map((factor) => (
          <li key={factor} className="border-border bg-surface rounded-card flex flex-col gap-2 border p-5">
            <FactorFigure factor={factor} />
            <b className="text-base font-semibold">{t(`${factor}.title`)}</b>
            <p className="text-muted text-[0.84375rem]">{t(`${factor}.body`)}</p>
          </li>
        ))}
      </ul>
      <h3 className="sr-only">{t("included")}</h3>
      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {included.map(({ key, yes }) => (
          <li key={key} className="bg-bg-subtle flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[0.84375rem]">
            <Icon
              name={yes ? "check" : "minus"}
              size={18}
              className={cn("mt-0.5 shrink-0", yes ? "text-primary" : "text-muted")}
              aria-hidden="true"
            />
            <span>
              <span className="sr-only">{t(yes ? "includedLabel" : "excludedLabel")}: </span>
              {t(key)}
            </span>
          </li>
        ))}
      </ul>
    </HubSection>
  );
}

/* ------------------------------------------------------------------------------------ วัสดุ */

type MaterialRow = { id: string; name: string; flute: string | null; use: string | null };

/** The flute a material is made on, from its attributes (`flute`) or its name ("ลอน B"); null if neither says. */
export function fluteOf(option: {
  nameTh: string;
  nameEn: string;
  attributes: Record<string, unknown>;
}): string | null {
  const attribute = typeof option.attributes.flute === "string" ? option.attributes.flute.toUpperCase() : "";
  const fromAttribute = /(BC|EB|[ABCEF])$/.exec(attribute)?.[1];
  if (fromAttribute) return fromAttribute;
  const fromName = /(?:ลอน|flute)\s*(BC|EB|[ABCEF])\b/i.exec(`${option.nameTh} ${option.nameEn}`)?.[1];
  return fromName ? fromName.toUpperCase() : null;
}

/** The materials of the instant corrugated products (configurator option groups), one row each, in offer order. */
export function materialRows(configurators: readonly Configurator[], locale: string): MaterialRow[] {
  const rows = new Map<string, MaterialRow>();
  for (const configurator of configurators) {
    if (configurator.calculator !== "corrugate") continue;
    for (const group of configurator.optionGroups) {
      if (group.kind !== "material") continue;
      for (const option of group.options) {
        if (rows.has(option.code)) continue;
        rows.set(option.code, {
          id: option.code,
          name: pick(locale, option.nameTh, option.nameEn),
          flute: fluteOf(option),
          use: locale === "en" ? (option.descriptionEn ?? option.descriptionTh) : option.descriptionTh,
        });
      }
    }
  }
  return [...rows.values()];
}

/** A flute's cross-section (prototype `.flute`): liners and one wave, a finer wave for E, two for BC. */
function FluteFigure({ flute, label }: { flute: string; label: string }) {
  const wave = "var(--color-primary)";
  if (flute === "BC" || flute === "EB")
    return (
      <svg viewBox="0 0 72 22" role="img" aria-label={label} className="text-border-strong h-[22px] w-[72px]">
        <path d="M2 2h68M2 11h68M2 20h68" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M2 6.5q4.5-5 9 0t9 0 9 0 9 0 9 0 9 0 9 0 9 0M2 15.5q6-5 12 0t12 0 12 0 12 0 12 0 12 0"
          fill="none"
          stroke={wave}
          strokeWidth="1.3"
        />
      </svg>
    );
  if (flute === "E" || flute === "F")
    return (
      <svg viewBox="0 0 72 22" role="img" aria-label={label} className="text-border-strong h-[22px] w-[72px]">
        <path d="M2 7h68M2 15h68" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M2 11q2.25-4 4.5 0t4.5 0 4.5 0 4.5 0 4.5 0 4.5 0 4.5 0 4.5 0 4.5 0 4.5 0 4.5 0 4.5 0 4.5 0 4.5 0 4.5 0 4.5 0"
          fill="none"
          stroke={wave}
          strokeWidth="1.2"
        />
      </svg>
    );
  return (
    <svg viewBox="0 0 72 22" role="img" aria-label={label} className="text-border-strong h-[22px] w-[72px]">
      <path d="M2 4h68M2 18h68" stroke="currentColor" strokeWidth={flute === "C" || flute === "A" ? 2.4 : 1.5} />
      <path d="M2 11q4.5-7 9 0t9 0 9 0 9 0 9 0 9 0 9 0 9 0" fill="none" stroke={wave} strokeWidth="1.5" />
    </svg>
  );
}

/**
 * "วัสดุกล่องลูกฟูก" (prompt item 10): the boards the instant corrugated products offer — name, flute
 * (with its cross-section) and, in the "หมายเหตุ" column, the admin's approved description (DECISIONS-STAGE-A §8, the
 * material's `description`; owner decision D-447 §10.10). A material without one leaves its cell empty — no invented
 * note — and the column goes when none has one. Hidden when no instant product is corrugated.
 * "เปรียบเทียบวัสดุทั้งหมด" opens the existing comparison.
 */
export async function MaterialsTable({ configurators }: { configurators: readonly Configurator[] }) {
  const [t, locale] = await Promise.all([getTranslations("products.materials"), getLocale()]);
  const rows = materialRows(configurators, locale);
  if (rows.length === 0) return null;
  const notes = rows.some((row) => row.use);
  const head = "text-muted bg-bg-subtle px-4 py-3 text-start text-[0.8125rem] font-medium";
  return (
    <HubSection
      id="materials"
      title={t("title")}
      lede={t("lede")}
      aside={
        <Button asChild variant="secondary">
          <Link href="/materials">{t("compare")}</Link>
        </Button>
      }
    >
      <div
        className="border-border bg-surface rounded-card relative overflow-x-auto border"
        tabIndex={0}
        role="region"
        aria-label={t("caption")}
      >
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">{t("caption")}</caption>
          <thead>
            <tr className="border-border border-b">
              <th scope="col" className={head}>
                {t("material")}
              </th>
              <th scope="col" className={head}>
                {t("flute")}
              </th>
              {notes ? (
                <th scope="col" className={head}>
                  {t("note")}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row" className="px-4 py-3.5 text-start align-top font-medium">
                  {row.name}
                </th>
                <td className="px-4 py-3.5 align-top">
                  {row.flute ? (
                    <FluteFigure flute={row.flute} label={t("fluteFigure", { flute: row.flute })} />
                  ) : (
                    t("none")
                  )}
                </td>
                {notes ? <td className="text-muted px-4 py-3.5 align-top">{row.use ?? ""}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </HubSection>
  );
}

/* ----------------------------------------------------------------------- ขั้นตอนและระยะเวลา */

const STEPS = ["choose", "pay", "produce", "deliver"] as const;
const PAYMENTS = ["transfer", "promptpay", "card"] as const;

/**
 * "ขั้นตอนและระยะเวลา" (prompt item 11): four steps, the production step's tag from the instant items' own
 * lead times, and the payment methods (content `products.process.paymentMethods`; "ผ่อนชำระ" stays hidden
 * until it is live — DECISIONS-STAGE-A §3).
 */
export async function ProcessSteps({ leadBand }: { leadBand: { min: number; max: number } | null }) {
  const t = await getTranslations("products.process");
  const tagOf = (step: (typeof STEPS)[number]) => {
    if (step !== "produce") return t(`steps.${step}.tag`);
    if (!leadBand) return null;
    return leadBand.min === leadBand.max
      ? t("steps.produce.tagExact", { days: leadBand.min })
      : t("steps.produce.tagRange", { min: leadBand.min, max: leadBand.max });
  };
  return (
    <HubSection id="process" title={t("title")} lede={t("lede")}>
      <ol className="border-border bg-surface rounded-card grid grid-cols-1 overflow-hidden border sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => {
          const tag = tagOf(step);
          return (
            <li
              key={step}
              className="border-border flex flex-col gap-2 border-b p-5 max-sm:last:border-b-0 lg:border-e lg:border-b-0 lg:last:border-e-0 sm:[&:nth-child(n+3)]:border-b-0 sm:[&:nth-child(odd)]:border-e"
            >
              <span
                aria-hidden="true"
                className="bg-primary-subtle text-primary-subtle-fg grid size-7 place-items-center rounded-full text-[0.8125rem] font-semibold"
              >
                {index + 1}
              </span>
              <b className="text-base font-semibold">{t(`steps.${step}.title`)}</b>
              <p className="text-muted text-[0.84375rem]">{t(`steps.${step}.body`)}</p>
              {tag ? (
                <span className="bg-bg-subtle text-muted rounded-control mt-auto self-start px-2.5 py-0.5 text-xs font-semibold">
                  {tag}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <h3 className="sr-only">{t("payments")}</h3>
      <ul aria-label={t("payments")} className="mt-3 flex flex-wrap gap-2">
        {PAYMENTS.map((method) => (
          <li key={method} className="border-border bg-surface rounded-lg border px-3 py-1.5 text-[0.8125rem]">
            {t(`paymentMethods.${method}`)}
          </li>
        ))}
      </ul>
    </HubSection>
  );
}

/* --------------------------------------------------------------------------------- บริการเสริม */

export interface ServiceLink {
  key: string;
  name: string;
  description: string | null;
  href: string;
}

const SERVICE_ICONS: IconName[] = ["palette", "box", "layers", "pen-tool", "wrench"];

/**
 * "บริการเสริม" (prompt item 12; owner decision D-447 / DECISIONS-STAGE-A §10.3): at most three service products as
 * link cards — the ones staff chose, in their order (`featuredServices`), else the first three the API lists — each
 * with its own description, and "ดูบริการทั้งหมด" (the hub filtered to services) when there are more. Hidden when
 * there are none.
 */
export async function ServiceLinks({
  services,
  allHref,
}: {
  services: readonly ServiceLink[];
  allHref: string | null;
}) {
  const t = await getTranslations("products.services");
  if (services.length === 0) return null;
  return (
    <HubSection
      id="services"
      title={t("title")}
      lede={t("lede")}
      aside={
        allHref ? (
          <Button asChild variant="secondary">
            <Link href={allHref}>{t("all")}</Link>
          </Button>
        ) : undefined
      }
    >
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {services.map((service, index) => (
          <li key={service.key}>
            <Link
              href={service.href}
              className="border-border bg-surface rounded-card hover:border-primary focus-visible:ring-focus-ring flex h-full items-start gap-3.5 border p-4.5 outline-none focus-visible:ring-2"
            >
              <span
                aria-hidden="true"
                className="bg-primary-subtle text-primary-subtle-fg grid size-10 shrink-0 place-items-center rounded-xl"
              >
                <Icon name={SERVICE_ICONS[index % SERVICE_ICONS.length]!} size={22} />
              </span>
              <span className="min-w-0">
                <b className="block text-[0.96875rem] font-semibold">{service.name}</b>
                {service.description ? (
                  <small className="text-muted line-clamp-2 text-[0.84375rem]">{service.description}</small>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </HubSection>
  );
}

/* ---------------------------------------------------------------------------------------- FAQ */

/** "คำถามที่พบบ่อย" (prompt item 13): eight questions from `products.faq` (BUSINESS-REVIEW), in two columns. */
export async function HubFaq({ company }: { company: string | null }) {
  const t = await getTranslations("products.faq");
  const items = FAQ_KEYS.map((key) => ({
    id: `faq-${key}`,
    summary: t(`items.${key}.q`),
    content: faqAnswer(t, key, company),
  }));
  const half = Math.ceil(items.length / 2);
  return (
    <HubSection id="faq" title={t("title")}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-x-8">
        <DisclosureList items={items.slice(0, half)} headingLevel="h3" />
        <DisclosureList items={items.slice(half)} headingLevel="h3" />
      </div>
    </HubSection>
  );
}

/* ------------------------------------------------------------------------------------- CTA band */

/**
 * The closing band (prompt item 14): "ขอใบเสนอราคา" and — only when getpack has a LINE account
 * (`NEXT_PUBLIC_LINE_OA_ID` or `support-channels.lineOaId`) — "คุยทาง LINE", with the hours staff keep
 * in `support-channels.hours` (none → no hours).
 */
export async function CtaBand({
  quoteHref,
  lineOaId,
  hours,
}: {
  quoteHref: string;
  lineOaId: string | null;
  hours: string | null;
}) {
  const t = await getTranslations("products.cta");
  const body = !lineOaId ? t("bodyNoLine") : hours ? t("bodyHours", { hours }) : t("body");
  return (
    <div className="bg-primary text-primary-fg rounded-panel mt-16 mb-24 grid grid-cols-1 items-center gap-5 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:p-8">
      <div>
        <h2 className="text-2xl font-semibold">{t("title")}</h2>
        <p className="mt-1.5 opacity-85">{body}</p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Button asChild className="bg-primary-fg text-primary hover:bg-primary-fg/90">
          <Link href={quoteHref}>{t("quote")}</Link>
        </Button>
        {lineOaId ? (
          <Button asChild variant="secondary" className="border-primary-fg/50 text-primary-fg hover:bg-primary-fg/10">
            <a
              href={`https://line.me/R/ti/p/${encodeURIComponent(lineOaId)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("line")}
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
