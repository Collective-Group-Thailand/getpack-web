"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { useMinWidth } from "@/features/agent/pipeline/useMinWidth";
import { useProblemText } from "@/features/agent/pipeline/problem";
import { ShareLink } from "@/features/agent/share/ShareLink";
import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { Skeleton } from "@/ui/components/Skeleton";
import { ProgressTracker } from "@/ui/components/ProgressTracker";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

type Product = Schemas["StoreProductCardDto"];
type Configurator = Schemas["StoreConfiguratorDto"];
type Calculation = Schemas["QuoteCalculationDto"];
type AgentQuote = Schemas["AgentQuoteDto"];
type Lead = Pick<Schemas["AgentLeadDto"], "id" | "contactName" | "organisationName" | "lineId">;

const SIZE_KEYS = ["l", "w", "d", "h"] as const;
type SizeKey = (typeof SIZE_KEYS)[number];
const MAX_QUANTITIES = 3;
const PRICE_DEBOUNCE_MS = 450;

const imageSrc = (url: string | null | undefined) =>
  url && url.startsWith("/v1/store/catalog/images/") ? `/bff${url}?size=thumb` : url && /^https:\/\//.test(url) ? url : null;

/** A configure section: collapsed to its summary on a phone, all open on a desktop. */
function Section({
  id,
  title,
  summary,
  wide,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  summary: React.ReactNode;
  wide: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const shown = wide || open;
  return (
    <section className="border-border bg-surface rounded-card border" aria-labelledby={`sec-${id}`}>
      <h3 id={`sec-${id}`} className="m-0">
        <button
          type="button"
          aria-expanded={shown}
          aria-controls={`body-${id}`}
          disabled={wide}
          onClick={onToggle}
          className="focus-visible:ring-focus-ring rounded-card flex min-h-14 w-full items-center justify-between gap-3 px-4 text-start outline-none focus-visible:ring-2 disabled:cursor-default"
        >
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">{title}</span>
            {!shown ? <span className="text-muted truncate text-sm">{summary}</span> : null}
          </span>
          {wide ? null : (
            <Icon name={shown ? "chevron-up" : "chevron-down"} size={18} aria-hidden="true" className="text-muted shrink-0" />
          )}
        </button>
      </h3>
      <div id={`body-${id}`} hidden={!shown} className="px-4 pb-4">
        {children}
      </div>
    </section>
  );
}

/**
 * Quote on behalf (D-468 §2, PROMPT P3 Web 4) — the agent-mode flow. The storefront's full configurator lives in the
 * customer zone (and carries the design studio, samples and cart with it); the agent zone gets its own focused flow on
 * the same contract instead (recorded in DESIGN-NOTES P3): pick a product → its D-441 default spec with the size,
 * material, quantities and delivery postcode the agent changes → the store's live price (`store.quotes.calculate`) in
 * a sticky bar → review → `store.agentQuotes.create` with the lead → share by LINE, the share sheet or a copied link.
 * Every figure is the API's; the web formats strings and never adds them up.
 */
export function NewQuoteFlow({ lead, products }: { lead: Lead; products: Product[] }) {
  const t = useTranslations("agentSales.newQuote");
  const locale = useLocale();
  const format = useFormat();
  const problemText = useProblemText();
  const wide = useMinWidth(1024);
  const [step, setStep] = useState<"product" | "configure" | "review" | "sent">("product");
  const [product, setProduct] = useState<Product | null>(null);
  const [configurator, setConfigurator] = useState<Configurator | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [size, setSize] = useState<Partial<Record<SizeKey, string>>>({});
  const [material, setMaterial] = useState<string | undefined>(undefined);
  const [quantities, setQuantities] = useState<number[]>([]);
  const [custom, setCustom] = useState("");
  const [postcode, setPostcode] = useState("");
  const [priced, setPriced] = useState<{ key: string; calculation: Calculation | null; error: string | null } | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<AgentQuote | null>(null);
  const [openSection, setOpenSection] = useState<string>("size");
  const name = (item: { nameTh: string; nameEn: string }) => (locale === "en" ? item.nameEn || item.nameTh : item.nameTh);

  const base = configurator?.defaultSpec?.configuration as Record<string, unknown> | undefined;
  const sizeKeys = useMemo(() => SIZE_KEYS.filter((key) => typeof base?.[key] === "number"), [base]);
  const materials = configurator?.optionGroups.find((group) => group.kind === "material")?.options ?? [];

  const choose = async (next: Product) => {
    setProduct(next);
    setConfigurator(null);
    setPriced(null);
    setLoadError(null);
    setStep("configure");
    try {
      const { data } = await browserApi().GET("/v1/store/catalog/products/{slug}/configurator", {
        params: { path: { slug: next.slug } },
      });
      if (!data?.instant || !data.defaultSpec) throw new Error("not instant");
      const spec = data.defaultSpec.configuration as Record<string, unknown>;
      setConfigurator(data);
      setSize(Object.fromEntries(SIZE_KEYS.filter((key) => typeof spec[key] === "number").map((key) => [key, String(spec[key])])));
      setMaterial(typeof spec["materialId"] === "string" ? (spec["materialId"] as string) : undefined);
      const presets = data.quantity.presets.length ? data.quantity.presets : [data.defaultSpec.quantity];
      setQuantities([data.defaultSpec.quantity ?? presets[0]!].filter(Boolean).slice(0, 1));
      setOpenSection("size");
    } catch (error) {
      setLoadError(isApiError(error) ? problemText(error) : t("notInstant"));
    }
  };

  /** The configuration to price: the default spec with the agent's changes. */
  const configuration = useMemo(() => {
    if (!base) return null;
    const next: Record<string, unknown> = { ...base, quantities: [...quantities].sort((a, b) => a - b) };
    for (const key of sizeKeys) {
      const value = Number(size[key]);
      if (!Number.isFinite(value) || value <= 0) return null;
      next[key] = value;
    }
    if (material) next["materialId"] = material;
    if (quantities.length === 0) return null;
    return next;
  }, [base, material, quantities, size, sizeKeys]);
  const postcodeOk = postcode === "" || /^\d{5}$/.test(postcode);

  // The live price, debounced; an answer counts only for the spec it was asked for (`key`).
  const priceKey = configurator && configuration && postcodeOk ? JSON.stringify([configuration, postcode]) : null;
  const pricing = priceKey !== null && priced?.key !== priceKey;
  const calculation = priced && priced.key === priceKey ? priced.calculation : null;
  const priceError = priced && priced.key === priceKey ? priced.error : null;
  const ticket = useRef(0);
  useEffect(() => {
    if (!configurator || !configuration || !priceKey) return;
    const mine = ++ticket.current;
    const timer = setTimeout(async () => {
      try {
        const { data } = await browserApi().POST("/v1/store/quotes/actions/calculate", {
          body: {
            productTypeCode: configurator.productTypeCode,
            configuration,
            ...(postcode ? { deliveryPostcode: postcode } : {}),
          },
        });
        if (mine !== ticket.current) return;
        setPriced({ key: priceKey, calculation: data ?? null, error: null });
      } catch (error) {
        if (mine !== ticket.current) return;
        setPriced({ key: priceKey, calculation: null, error: problemText(error) });
      }
    }, PRICE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [configuration, configurator, postcode, priceKey, problemText]);

  const pricedSteps = calculation?.steps.filter((entry) => entry.instant && entry.grossAmount) ?? [];
  const largest = pricedSteps.at(-1);
  const canReview = Boolean(configuration && pricedSteps.length > 0 && !pricing && postcodeOk);

  const create = async () => {
    if (!configurator || !configuration) return;
    setCreating(true);
    setCreateError(null);
    try {
      const { data } = await browserApi().POST("/v1/store/agent/quotes", {
        body: {
          leadId: lead.id,
          productTypeCode: configurator.productTypeCode,
          configuration,
          ...(postcode ? { deliveryPostcode: postcode } : {}),
        },
      });
      setCreated(data ?? null);
      setStep("sent");
      window.scrollTo({ top: 0 });
    } catch (error) {
      setCreateError(problemText(error));
    } finally {
      setCreating(false);
    }
  };

  const toggleQuantity = (value: number) =>
    setQuantities((current) =>
      current.includes(value)
        ? current.filter((entry) => entry !== value)
        : current.length >= MAX_QUANTITIES
          ? current
          : [...current, value],
    );

  const steps = [
    { id: "product", title: t("steps.product") },
    { id: "configure", title: t("steps.configure") },
    { id: "review", title: t("steps.review") },
    { id: "sent", title: t("steps.sent") },
  ];
  const order = ["product", "configure", "review", "sent"];
  const current = order.indexOf(step);

  const priceBar = (
    <div className="flex items-center justify-between gap-3" aria-live="polite">
      <div className="min-w-0">
        {pricing ? (
          <p className="text-muted text-sm">{t("pricing")}</p>
        ) : largest ? (
          <>
            <p className="text-muted text-xs">{t("priceFor", { quantity: format.number(largest.quantity) })}</p>
            <p className="text-lg leading-tight font-semibold tabular-nums">{format.thb(largest.grossAmount)}</p>
            <p className="text-muted text-xs tabular-nums">{t("perUnit", { price: format.thb(largest.unitPrice) })}</p>
          </>
        ) : (
          <p className="text-muted text-sm">{priceError ?? t("noPrice")}</p>
        )}
      </div>
      <Button disabled={!canReview} onClick={() => setStep("review")} iconEnd="arrow-right" className="shrink-0">
        {t("toReview")}
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="border-border bg-surface rounded-card flex flex-wrap items-center gap-x-4 gap-y-2 border px-4 py-3">
        <span className="bg-primary-subtle text-primary grid size-9 place-items-center rounded-full">
          <Icon name="user" size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-muted block text-xs">{t("for")}</span>
          <span className="block truncate font-semibold">
            {lead.contactName}
            {lead.organisationName ? <span className="text-muted font-normal"> · {lead.organisationName}</span> : null}
          </span>
        </span>
        <ProgressTracker
          label={t("progress")}
          stateLabels={{ done: t("stateDone"), current: t("stateCurrent"), upcoming: "", skipped: "" }}
          stages={steps.map((entry, index) => ({
            key: entry.id,
            title: entry.title,
            state: index < current ? "done" : index === current ? "current" : "upcoming",
          }))}
          className="hidden md:flex md:w-full lg:w-auto lg:min-w-[28rem]"
        />
      </div>

      {step === "product" ? (
        <section aria-labelledby="pick-product" className="flex flex-col gap-4">
          <h2 id="pick-product" className="text-lg font-semibold">
            {t("pickProduct")}
          </h2>
          {products.length === 0 ? (
            <Callout tone="info" title={t("noProducts")} />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((item) => {
                const src = imageSrc(item.imageUrl);
                return (
                  <li key={item.slug}>
                    <button
                      type="button"
                      onClick={() => void choose(item)}
                      className="border-border bg-surface focus-visible:ring-focus-ring hover:border-primary/40 active:bg-surface-subtle rounded-card flex h-full w-full flex-col overflow-hidden border text-start outline-none transition-colors duration-100 focus-visible:ring-2"
                    >
                      <span className="bg-surface-subtle block aspect-[4/3] w-full">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element -- the catalogue's thumbnail through this zone's BFF
                          <img src={src} alt="" loading="lazy" className="size-full object-cover" />
                        ) : (
                          <span className="text-muted grid size-full place-items-center">
                            <Icon name="box" size={28} aria-hidden="true" />
                          </span>
                        )}
                      </span>
                      <span className="flex flex-1 flex-col gap-1 p-3">
                        <span className="text-sm leading-snug font-semibold">{name(item)}</span>
                        {item.startingPricePerPiece ? (
                          <span className="text-muted text-xs tabular-nums">{t("from", { price: format.thb(item.startingPricePerPiece) })}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {step === "configure" && product ? (
        <div className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:pb-0">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{name(product)}</h2>
              <Button variant="ghost" size="sm" iconStart="chevron-left" className="min-h-11 sm:min-h-8" onClick={() => setStep("product")}>
                {t("changeProduct")}
              </Button>
            </div>
            {loadError ? <Callout tone="warning" title={loadError} /> : null}
            {!configurator && !loadError ? <Skeleton className="h-64 w-full" /> : null}
            {configurator ? (
              <>
                {sizeKeys.length > 0 ? (
                  <Section id="size" wide={wide} open={openSection === "size"} onToggle={() => setOpenSection((cur) => (cur === "size" ? "" : "size"))} title={t("size")} summary={sizeKeys.map((key) => size[key]).join(" × ") + " " + t("mm")}>
                    <div className={cn("grid gap-3", sizeKeys.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
                      {sizeKeys.map((key) => (
                        <Field key={key} label={t(`dims.${key}`)} hint={t("mm")}>
                          <Input
                            inputMode="numeric"
                            value={size[key] ?? ""}
                            onChange={(event) => setSize((current) => ({ ...current, [key]: event.target.value.replace(/[^0-9.]/g, "") }))}
                          />
                        </Field>
                      ))}
                    </div>
                  </Section>
                ) : null}
                {materials.length > 0 ? (
                  <Section id="material" wide={wide} open={openSection === "material"} onToggle={() => setOpenSection((cur) => (cur === "material" ? "" : "material"))} title={t("material")} summary={name(materials.find((entry) => entry.id === material) ?? materials[0]!)}>
                    <RadioCards
                      columns={2}
                      value={material}
                      onValueChange={setMaterial}
                      options={materials.slice(0, 8).map((option) => ({
                        value: option.id,
                        label: name(option),
                        description: (locale === "en" ? option.descriptionEn : option.descriptionTh) ?? undefined,
                      }))}
                    />
                  </Section>
                ) : null}
                <Section
                  id="quantity"
                  wide={wide}
                  open={openSection === "quantity"}
                  onToggle={() => setOpenSection((cur) => (cur === "quantity" ? "" : "quantity"))}
                  title={t("quantity")}
                  summary={[...quantities].sort((a, b) => a - b).map((value) => format.number(value)).join(" · ") || t("pickQuantity")}
                >
                  <p className="text-muted mb-2 text-sm">{t("quantityHint", { max: MAX_QUANTITIES })}</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label={t("quantity")}>
                    {[...new Set([...configurator.quantity.presets, ...quantities])].sort((a, b) => a - b).map((value) => (
                      <Button
                        key={value}
                        type="button"
                        size="sm"
                        variant={quantities.includes(value) ? "primary" : "secondary"}
                        aria-pressed={quantities.includes(value)}
                        className="min-h-11 tabular-nums sm:min-h-8"
                        onClick={() => toggleQuantity(value)}
                      >
                        {format.number(value)}
                      </Button>
                    ))}
                  </div>
                  <form
                    className="mt-3 flex items-end gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const value = Number(custom);
                      const min = configurator.quantity.min ?? 1;
                      const max = configurator.quantity.max ?? Number.MAX_SAFE_INTEGER;
                      if (Number.isInteger(value) && value >= min && value <= max) {
                        toggleQuantity(value);
                        setCustom("");
                      }
                    }}
                  >
                    <Field label={t("customQuantity")} className="min-w-0 flex-1 sm:max-w-48">
                      <Input inputMode="numeric" value={custom} onChange={(event) => setCustom(event.target.value.replace(/[^0-9]/g, ""))} />
                    </Field>
                    <Button type="submit" variant="secondary" className="min-h-11 sm:min-h-0" disabled={!custom || quantities.length >= MAX_QUANTITIES}>
                      {t("addQuantity")}
                    </Button>
                  </form>
                  <p className="text-muted mt-1 text-xs">
                    {t("quantityRange", {
                      min: format.number(configurator.quantity.min ?? 1),
                      max: configurator.quantity.max ? format.number(configurator.quantity.max) : "—",
                    })}
                  </p>
                </Section>
                <Section id="delivery" wide={wide} open={openSection === "delivery"} onToggle={() => setOpenSection((cur) => (cur === "delivery" ? "" : "delivery"))} title={t("delivery")} summary={postcode || t("noPostcode")}>
                  <Field label={t("postcode")} hint={t("postcodeHint")} error={postcodeOk ? undefined : t("postcodeInvalid")}>
                    <Input
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={5}
                      value={postcode}
                      onChange={(event) => setPostcode(event.target.value.replace(/[^0-9]/g, ""))}
                      className="sm:max-w-40"
                    />
                  </Field>
                </Section>
              </>
            ) : null}
          </div>

          {configurator ? (
            <aside aria-label={t("priceLabel")} className="hidden lg:sticky lg:top-20 lg:block">
              <div className="border-border bg-surface rounded-card flex flex-col gap-4 border p-5">
                <h2 className="font-semibold">{t("priceLabel")}</h2>
                {pricedSteps.length > 0 && !pricing ? (
                  <ul className="divide-border flex flex-col divide-y text-sm">
                    {pricedSteps.map((entry) => (
                      <li key={entry.quantity} className="flex items-baseline justify-between gap-3 py-2 tabular-nums">
                        <span>{t("pieces", { quantity: format.number(entry.quantity) })}</span>
                        <span className="text-end">
                          <span className="block font-semibold">{format.thb(entry.grossAmount)}</span>
                          <span className="text-muted block text-xs">{t("perUnit", { price: format.thb(entry.unitPrice) })}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {priceBar}
                <p className="text-muted text-xs">{t("vatNote")}</p>
              </div>
            </aside>
          ) : null}
          {configurator ? (
            <div
              data-mobile-bar=""
              className="border-border bg-surface z-sticky shadow-overlay fixed inset-x-0 bottom-(--mobile-tab-h) border-t px-4 py-2.5 ps-[max(1rem,env(safe-area-inset-left))] pe-[max(1rem,env(safe-area-inset-right))] lg:hidden"
            >
              {priceBar}
            </div>
          ) : null}
        </div>
      ) : null}

      {step === "review" && product && calculation ? (
        <section aria-labelledby="review" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="border-border bg-surface rounded-card flex flex-col gap-4 border p-4 sm:p-5">
            <h2 id="review" className="text-lg font-semibold">
              {t("reviewTitle", { product: name(product) })}
            </h2>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {calculation.specs.map((spec) => (
                <div key={spec.key} className="flex flex-col">
                  <dt className="text-muted text-xs">{locale === "en" ? spec.labelEn : spec.labelTh}</dt>
                  <dd>{locale === "en" ? spec.valueEn : spec.valueTh}</dd>
                </div>
              ))}
              {postcode ? (
                <div className="flex flex-col">
                  <dt className="text-muted text-xs">{t("postcode")}</dt>
                  <dd className="tabular-nums">{postcode}</dd>
                </div>
              ) : null}
            </dl>
            <table className="w-full text-sm">
              <caption className="sr-only">{t("priceLabel")}</caption>
              <thead className="text-muted text-xs">
                <tr className="border-border border-b">
                  <th scope="col" className="py-2 text-start font-medium">{t("quantity")}</th>
                  <th scope="col" className="py-2 text-end font-medium">{t("unitPrice")}</th>
                  <th scope="col" className="py-2 text-end font-medium">{t("total")}</th>
                </tr>
              </thead>
              <tbody>
                {pricedSteps.map((entry) => (
                  <tr key={entry.quantity} className="border-border border-b last:border-b-0 tabular-nums">
                    <td className="py-2.5">{format.number(entry.quantity)}</td>
                    <td className="py-2.5 text-end">{format.thb(entry.unitPrice)}</td>
                    <td className="py-2.5 text-end font-semibold">{format.thb(entry.grossAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-muted text-xs">
              {t("validity", { days: configurator?.quoteValidityDays ?? 0 })} {t("vatNote")}
            </p>
          </div>
          <div className="border-border bg-surface rounded-card flex flex-col gap-3 border p-4 sm:p-5">
            <p className="text-sm">{t("reviewBody", { name: lead.contactName })}</p>
            {createError ? <Callout tone="danger" title={createError} live /> : null}
            <Button size="lg" iconStart="send" loading={creating} onClick={() => void create()}>
              {t("create")}
            </Button>
            <Button variant="secondary" onClick={() => setStep("configure")} disabled={creating}>
              {t("back")}
            </Button>
          </div>
        </section>
      ) : null}

      {step === "sent" && created ? (
        <section aria-labelledby="sent" className="border-border bg-surface rounded-card flex flex-col gap-4 border p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="bg-success-subtle text-success-subtle-fg grid size-10 shrink-0 place-items-center rounded-full">
              <Icon name="check" size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 id="sent" className="text-lg font-semibold" tabIndex={-1}>
                {t("sentTitle")}
              </h2>
              <p className="text-muted text-sm">{t("sentBody", { name: lead.contactName, code: created.quote.quoteCode ?? "" })}</p>
            </div>
          </div>
          {created.dealRegistration ? (
            <Callout tone="success" icon="shield-check" title={t("dealRegistered", { date: format.date(created.dealRegistration.protectedUntil) })} />
          ) : null}
          {created.shareUrl ? (
            <ShareLink
              link={created.shareUrl}
              code={created.quote.quoteCode ?? ""}
              message={t("shareMessage", { name: lead.contactName })}
            />
          ) : null}
          <div className="border-border flex flex-wrap gap-2 border-t pt-4">
            <Button asChild variant="secondary">
              <Link href={`/quotes/${created.id}`}>{t("openQuote")}</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href={`/leads/${lead.id}`}>{t("backToLead")}</Link>
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
