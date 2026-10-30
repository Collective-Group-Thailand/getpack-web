"use client";

import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { materialNoteKey } from "@/features/customer/configurator/material-notes";
import { useQuoteActions } from "@/features/customer/configurator/useQuoteActions";
import { useFormat } from "@/features/shared/format/useFormat";
import { specLabelText } from "@/features/shared/spec-label";
import { Link, useRouter } from "@/i18n/navigation";
import { trackPdp } from "@/lib/analytics/pdp";
import { Button } from "@/ui/components/Button";
import { Skeleton } from "@/ui/components/Skeleton";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import {
  customSizeLinkOf,
  hasStandardSizes,
  materialsOf,
  pickMaterial,
  pickQuantity,
  pickSize,
  printChoicesOf,
  tiersOf,
  type PrintChoice,
} from "./model";
import { usePdp } from "./PdpProvider";

const SignInSheet = dynamic(() => import("@/features/customer/auth/SignInSheet").then((module) => module.SignInSheet), {
  ssr: false,
});

/** A picker's heading row: its name, and a note or link at the end (prototype `.opt-h`). */
function OptionHead({ label, id, children }: { label: string; id: string; children?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3 text-[0.8125rem]">
      <span id={id} className="font-semibold">
        {label}
      </span>
      {children}
    </div>
  );
}

const choice =
  "border-border-strong bg-surface focus-visible:ring-focus-ring rounded-control border outline-none focus-visible:ring-2 disabled:opacity-60";
/** Board and quantity cards: chosen = the brand's tint with an inner ring (prototype `.mats`, `.qtys`). */
const card = cn(
  choice,
  "aria-pressed:border-primary aria-pressed:bg-primary-subtle aria-pressed:ring-primary aria-pressed:ring-1 aria-pressed:ring-inset",
);

/**
 * The buy box's price and pickers (pdp redesign item 3): the unit price and total for the selection with
 * its line "{qty} ชิ้น · เบอร์ X · รวม VAT แล้ว · ไม่รวมค่าจัดส่ง", the size / board / outside print /
 * quantity pickers bound to the configurator's option data, the actions and the assurances — every
 * figure, date and tolerance from the configurator's own calculation. The price area keeps its height
 * while a price loads (a skeleton), so nothing below moves.
 */
export function PdpBuyBox({
  dielineFallback,
  studioHref,
  guaranteeHref,
  materialsAnchor,
}: {
  /** Where "แบบกล่อง" goes when the API names no dieline variant (the old fallback). */
  dielineFallback: string;
  /** The Studio for this product, when its templates are online (shown instead of a missing dieline). */
  studioHref: string | null;
  guaranteeHref: string;
  /** The id of the page's materials section ("เลือกวัสดุอย่างไร"). */
  materialsAnchor: string | null;
}) {
  const t = useTranslations("catalog.pdp");
  const tMaterialNotes = useTranslations("configurator.materialNotes");
  const tUnits = useTranslations("catalog.stock.units");
  const locale = useLocale();
  const format = useFormat();
  const router = useRouter();
  const pdp = usePdp();
  const { configurator, selection, choose, price, current, steps, configureLink, dielineHref } = pdp;
  const slug = configurator.slug;
  const unit = tUnits(configurator.unit);

  const [session, setSession] = useState(pdp.signedIn);
  const [signIn, setSignIn] = useState<{ open: boolean; then: (() => void) | null }>({ open: false, then: null });
  const actions = useQuoteActions({
    configurator,
    state: selection,
    productName: pdp.productName,
    signedIn: session,
    requestSignIn: (then) => setSignIn({ open: true, then }),
    anonymousId: "",
    onLeverApplied: () => undefined,
  });

  const size = configurator.standardSizes.find((entry) => entry.code === selection.standardSizeCode) ?? null;
  const sizes = hasStandardSizes(configurator) ? configurator.standardSizes : [];
  const materials = materialsOf(configurator);
  const prints = printChoicesOf(configurator, selection);
  const tiers = tiersOf(selection);
  const stepOf = (quantity: number) => steps.find((step) => step.quantity === quantity) ?? null;
  const loading = !current && (price.isLoading || price.pending);
  const failed = !current && !loading && price.isError;
  const quoteOnly = !current && !loading && !failed && stepOf(selection.quantity) !== null;
  const specLabel = specLabelText(price.data?.specLabel, locale);
  const mm = (value: number) => format.number(value);

  const printLabel = (entry: PrintChoice) => {
    switch (entry.label.kind) {
      case "none":
        return t("options.printNone");
      case "cmyk":
        return t("options.printCmyk");
      case "spot":
        return t("options.printSpot");
      default:
        return pick(locale, entry.label.option.nameTh, entry.label.option.nameEn);
    }
  };

  // "ถูกกว่า x%": the API's own saving at the largest tier it priced instantly (C4-API-2).
  const largest = [...steps].reverse().find((step) => step.instant && (step.savingPercent ?? 0) > 0) ?? null;
  const shortage = current?.toleranceShortagePct ?? null;
  const overage = current?.toleranceOveragePct ?? null;
  const b = (chunks: React.ReactNode) => <b className="font-semibold">{chunks}</b>;

  return (
    <div className="border-border bg-surface rounded-card flex flex-col gap-5 border p-4 md:p-5">
      {/* The price, its quantity line and the spec line (D-441): their height is kept while the first price
          loads, so the pickers below do not move (CLS). Project A: on the pale brand tint, the figure in green. */}
      <div
        aria-live="polite"
        aria-busy={loading || price.pending}
        className="bg-primary-subtle min-h-[7.5rem] rounded-xl p-4 md:p-5"
      >
        {current?.unitPrice ? (
          <>
            <p className={cn("m-0 flex flex-wrap items-baseline gap-x-2.5", price.pending && "opacity-60")}>
              <b className="text-primary text-[2.125rem] leading-none font-semibold tracking-tight tabular-nums md:text-[2.625rem]">
                {format.thb(current.unitPrice)}
              </b>
              <span className="text-muted tabular-nums">
                {t("price.perUnit", { unit })}
                {current.grossAmount ? ` · ${t("price.total", { total: format.thb(current.grossAmount) })}` : null}
              </span>
            </p>
            <p className="text-muted mt-2 text-[0.8125rem] tabular-nums">
              {size
                ? t("price.sub", { qty: format.number(selection.quantity), unit, size: size.code })
                : t("price.subNoSize", { qty: format.number(selection.quantity), unit })}
            </p>
            {/* D-441: which spec the price is for, in the API's one string. */}
            {specLabel ? <p className="text-muted mt-1 text-xs leading-snug">{specLabel}</p> : null}
          </>
        ) : loading ? (
          <div>
            <Skeleton className="bg-surface h-10 w-56" />
            <Skeleton className="bg-surface mt-3 h-3.5 w-72 max-w-full" />
            <span className="sr-only">{t("price.loading")}</span>
          </div>
        ) : failed ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-danger-subtle-fg m-0 text-sm">{t("price.error")}</p>
            <Button size="sm" variant="secondary" onClick={() => void price.refetch()}>
              {t("price.retry")}
            </Button>
          </div>
        ) : quoteOnly ? (
          <div>
            <p className="m-0 text-lg font-semibold">{t("price.quoteOnly")}</p>
            <p className="text-muted mt-1 text-[0.8125rem]">{t("price.quoteOnlyNote")}</p>
          </div>
        ) : (
          <p className="text-muted m-0 text-sm">{t("price.incomplete")}</p>
        )}
      </div>

      {sizes.length > 0 ? (
        <div>
          <OptionHead label={t("options.size")} id="pdp-size-label">
            {size ? (
              <small className="text-muted tabular-nums">
                {t("options.sizeInside", { l: mm(size.lengthMm), w: mm(size.widthMm), h: mm(size.heightMm) })}
              </small>
            ) : null}
          </OptionHead>
          <div role="group" aria-labelledby="pdp-size-label" className="flex flex-wrap gap-1.5">
            {sizes.map((entry) => (
              <button
                key={entry.code}
                type="button"
                aria-pressed={selection.standardSizeCode === entry.code}
                aria-label={t("options.sizeButton", {
                  size: entry.code,
                  l: mm(entry.lengthMm),
                  w: mm(entry.widthMm),
                  h: mm(entry.heightMm),
                })}
                onClick={() =>
                  choose(pickSize(configurator, selection, entry.code), { option: "size", value: entry.code })
                }
                className={cn(
                  choice,
                  "h-9.5 min-w-11.5 px-2.5 text-[0.84375rem] font-medium tabular-nums",
                  "aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-fg",
                )}
              >
                {entry.code}
              </button>
            ))}
            <Link
              href={customSizeLinkOf(configurator, selection)}
              onClick={() => trackPdp("pdp_cta", { product: slug, cta: "custom_size" })}
              className={cn(
                choice,
                "inline-flex h-9.5 items-center border-dashed px-3 text-[0.84375rem] font-medium no-underline",
              )}
            >
              {t("options.custom")}
            </Link>
          </div>
        </div>
      ) : null}

      {materials.length > 1 ? (
        <div>
          <OptionHead label={t("options.material")} id="pdp-material-label">
            {materialsAnchor ? (
              <a
                href={`#${materialsAnchor}`}
                className="text-primary text-[0.78125rem] font-medium underline underline-offset-4"
              >
                {t("options.materialHelp")}
              </a>
            ) : null}
          </OptionHead>
          <div role="group" aria-labelledby="pdp-material-label" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {materials.map((option) => {
              // The configurator's own one-line note: the approved content line, else the API's description.
              const key = materialNoteKey(option);
              const note =
                key && tMaterialNotes.has(key)
                  ? tMaterialNotes(key)
                  : pick(locale, option.descriptionTh ?? "", option.descriptionEn ?? "") || null;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selection.choices.material?.[0] === option.id}
                  onClick={() => choose(pickMaterial(selection, option.id), { option: "material", value: option.code })}
                  className={cn(
                    card,
                    "flex flex-col items-start gap-0.5 px-3 py-2.5 text-start text-[0.84375rem] font-medium",
                  )}
                >
                  {pick(locale, option.nameTh, option.nameEn)}
                  {note ? <small className="text-muted text-xs font-normal">{note}</small> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {prints.length > 1 ? (
        <div>
          <OptionHead label={t("options.print")} id="pdp-print-label" />
          <div role="group" aria-labelledby="pdp-print-label" className="flex flex-wrap gap-1.5">
            {prints.map((entry) => (
              <button
                key={entry.key}
                type="button"
                aria-pressed={entry.selected}
                onClick={() =>
                  choose(entry.selection, {
                    option: "print",
                    value: entry.label.kind === "ink" ? entry.label.option.code : entry.label.kind,
                  })
                }
                className={cn(
                  choice,
                  "text-muted min-h-9 px-3.5 text-[0.84375rem]",
                  "aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-fg",
                )}
              >
                {printLabel(entry)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {tiers.length > 0 ? (
        <div>
          <OptionHead label={t("options.quantity")} id="pdp-quantity-label">
            {largest ? <small className="text-muted">{t("options.quantityHint")}</small> : null}
          </OptionHead>
          <div role="group" aria-labelledby="pdp-quantity-label" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {tiers.map((quantity) => {
              const step = stepOf(quantity);
              return (
                <button
                  key={quantity}
                  type="button"
                  aria-pressed={selection.quantity === quantity}
                  onClick={() =>
                    choose(pickQuantity(selection, quantity), { option: "quantity", value: String(quantity) })
                  }
                  className={cn(
                    card,
                    "flex min-h-14 flex-col items-center justify-center px-1 py-2 text-sm font-semibold tabular-nums",
                  )}
                >
                  {format.number(quantity)}
                  <small
                    className={cn(
                      "text-muted text-xs font-normal",
                      selection.quantity === quantity && "text-primary-subtle-fg",
                      price.pending && "opacity-60",
                    )}
                  >
                    {step?.instant && step.unitPrice ? (
                      format.thb(step.unitPrice)
                    ) : step ? (
                      t("options.quantityQuote")
                    ) : (
                      <span className="bg-bg-subtle inline-block h-3 w-12 animate-pulse rounded-sm align-middle" />
                    )}
                  </small>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* One primary action; the rest are quiet ghost actions in one wrapping row (Project A), never clipped. */}
      <div className="flex flex-col gap-2">
        <Button asChild size="lg" block iconEnd="arrow-right">
          <Link href={configureLink} onClick={() => trackPdp("pdp_cta", { product: slug, cta: "configure" })}>
            {t("cta.configure")}
          </Link>
        </Button>
        <div className="border-border flex flex-wrap justify-center gap-x-1 gap-y-0.5 border-b pb-3">
          <Button
            variant="ghost"
            size="sm"
            iconStart="save"
            className="text-[0.84375rem]"
            disabled={actions.busy === "save" || !current}
            onClick={() => {
              trackPdp("pdp_cta", { product: slug, cta: "save_quote" });
              actions.run("save");
            }}
          >
            {t("cta.saveQuote")}
          </Button>
          {dielineHref || !studioHref ? (
            <Button asChild variant="ghost" size="sm" iconStart="download" className="text-[0.84375rem]">
              <Link
                href={dielineHref ?? dielineFallback}
                onClick={() => trackPdp("pdp_cta", { product: slug, cta: "dieline" })}
              >
                {size && dielineHref ? t("cta.dieline", { size: size.code }) : t("cta.dielineAny")}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" iconStart="pen-tool" className="text-[0.84375rem]">
              <Link href={studioHref}>{t("cta.designOnline")}</Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="sm" iconStart="chat" className="text-[0.84375rem]">
            <Link href="/help/chat" onClick={() => trackPdp("pdp_cta", { product: slug, cta: "ask" })}>
              {t("cta.ask")}
            </Link>
          </Button>
        </div>
      </div>

      <ul className="bg-surface-subtle m-0 flex list-none flex-col gap-2.5 rounded-xl p-4 text-[0.84375rem]">
        {current?.earliestShipDate ? (
          <li className="flex items-start gap-2.5">
            <Icon name="truck" size={18} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
            <span>
              {t.rich("assure.ready", { date: format.date(current.earliestShipDate), b })}
              {current.leadTimeDays ? ` · ${t("assure.lead", { days: current.leadTimeDays })}` : null}
            </span>
          </li>
        ) : null}
        {largest?.unitPrice ? (
          <li className="flex items-start gap-2.5">
            <Icon name="layers" size={18} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
            <span>
              {t.rich("assure.saving", {
                qty: format.number(largest.quantity),
                unit,
                price: format.thb(largest.unitPrice),
                pct: largest.savingPercent ?? 0,
                b,
              })}
            </span>
          </li>
        ) : null}
        {shortage ? (
          <li className="flex items-start gap-2.5">
            <Icon name="scale" size={18} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
            <span>
              {overage === shortage || !overage
                ? t.rich("assure.tolerance", { pct: format.percent(shortage), b })
                : t.rich("assure.toleranceSplit", {
                    short: format.percent(shortage),
                    over: format.percent(overage),
                    b,
                  })}
            </span>
          </li>
        ) : null}
        {configurator.quoteValidityDays ? (
          <li className="flex items-start gap-2.5">
            <Icon name="save" size={18} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
            <span>{t.rich("assure.lock", { days: configurator.quoteValidityDays, b })}</span>
          </li>
        ) : null}
        <li className="flex items-start gap-2.5">
          <Icon name="shield" size={18} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
          <Link href={guaranteeHref} className="text-primary underline underline-offset-4">
            {t("assure.guarantee")}
          </Link>
        </li>
      </ul>

      {signIn.open ? (
        <SignInSheet
          open={signIn.open}
          onOpenChange={(open) => setSignIn((currentSignIn) => ({ open, then: open ? currentSignIn.then : null }))}
          onSignedIn={() => {
            const then = signIn.then;
            setSignIn({ open: false, then: null });
            setSession(true);
            router.refresh();
            then?.();
          }}
        />
      ) : null}
    </div>
  );
}
