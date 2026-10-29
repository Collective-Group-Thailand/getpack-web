"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { announceCartAdd } from "@/features/customer/cart/cart-events";
import { pick } from "@/features/customer/catalog/localize";
import { buildCalculateBody } from "@/features/customer/configurator/build";
import { optionsById } from "@/features/customer/configurator/model";
import { saveQuote, useLivePrice } from "@/features/customer/configurator/pricing";
import {
  choiceOf,
  choiceValues,
  idsOfChoice,
  methodOf,
  sideModelOf,
  type PrintSide,
} from "@/features/customer/configurator/print-model";
import {
  initialState,
  withStandardSize,
  type Configurator,
  type ConfiguratorState,
} from "@/features/customer/configurator/state";
import { useFormat } from "@/features/shared/format/useFormat";
import { Link, useRouter } from "@/i18n/navigation";
import { trackUpload } from "@/lib/analytics";
import { isApiError } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/ui/components/Button";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { addCheckedFileToCart, checkKey, updateSpec, type FileCheck } from "./api";
import type { UploadProduct } from "./types";

/** The print choice of the outside, as the configurator holds it (D-443): `none`, `cmyk`, `spot`, `spot:<ink>`. */
function stateWith(configurator: Configurator, sizeCode: string | null, choice: string | null): ConfiguratorState {
  let state = initialState(configurator, { designOption: "own_file" });
  const size = configurator.standardSizes.find((s) => s.code === sizeCode);
  if (size) state = withStandardSize(state, size);
  const side = sideModelOf(configurator, "print_front");
  if (side && choice) {
    state = {
      ...state,
      choices: { ...state.choices, print_front: idsOfChoice(side, choice, state.choices.print_front ?? []) },
    };
  }
  return state;
}

/**
 * Spec & price (upload redesign Phase 2 item 5), sticky beside the workspace on wide screens: the product and inside
 * size the file is checked against, the material, the files; the inks found in the file with the method that prints
 * them (the product's print model, D-443 — every method priced by the API, so the cheaper one shows); quantity tiers
 * with the API's unit prices (one file) or a quantity per file (several, each its own cart line priced on its own:
 * the per-variant price waits for C8-2); goods, VAT and total exactly as the API sends them (no arithmetic here);
 * production days, the ship date, tolerances; and "เพิ่มลงตะกร้าพร้อมไฟล์" — closed while something must be fixed or
 * a file is still checking; without an instant price, the quotation path of /configure.
 */
export function SummaryCard({
  check,
  products,
  configurator,
}: {
  check: FileCheck;
  products: UploadProduct[];
  configurator: Configurator | null;
}) {
  const t = useTranslations("studio.upload.summary");
  const tTol = useTranslations("configurator.summary");
  const locale = useLocale();
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"cart" | "quote" | null>(null);
  const variants = check.variants;
  const many = variants.length > 1;

  const side: PrintSide | null = configurator ? sideModelOf(configurator, "print_front") : null;
  const inks = variants.map((v) => v.current.report?.inks).find(Boolean) ?? null;
  const hasInk = (id: string) => (configurator ? optionsById(configurator).has(id) : false);
  const choices = side ? choiceValues(side, hasInk) : [];
  const methodChoice = (method: string | null) =>
    method === "cmyk" ? "cmyk" : method === "none" ? "none" : (choices.find((c) => c.startsWith("spot")) ?? null);
  const chosen =
    (check.spec.printMethod && choices.includes(methodChoice(check.spec.printMethod) ?? "")
      ? methodChoice(check.spec.printMethod)
      : null) ??
    (inks ? methodChoice(inks.recommended) : null) ??
    (side && configurator ? choiceOf(side, initialState(configurator).choices.print_front ?? []) : null);

  const tiers = useMemo(() => (configurator ? initialState(configurator).quantities : []), [configurator]);
  const [quantity, setQuantity] = useState<number | null>(null);
  const [perVariant, setPerVariant] = useState<Record<number, number>>({});
  const single = quantity ?? configurator?.quantity.default ?? tiers[0] ?? null;
  const variantQty = (n: number) => perVariant[n] ?? single ?? 0;
  const quantities = many
    ? [...new Set(variants.map((v) => variantQty(v.variantNo)))].filter((q) => q > 0).sort((a, b) => a - b)
    : tiers;

  const state = configurator ? stateWith(configurator, check.spec.sizeCode, chosen) : null;
  const body =
    configurator && state && check.spec.sizeCode && quantities.length
      ? (() => {
          const calc = buildCalculateBody(configurator, { ...state, quantities });
          return { ...calc, configuration: { ...calc.configuration, quantities } };
        })()
      : null;
  const price = useLivePrice(body);
  const steps = price.data?.steps ?? [];
  const stepOf = (q: number) => steps.find((s) => s.quantity === q) ?? null;
  const current = many ? null : single !== null ? stepOf(single) : null;
  const instant = many ? variants.every((v) => stepOf(variantQty(v.variantNo))?.instant) : current?.instant === true;
  const blocking = check.blocking;
  const inCart = variants.every((v) => v.current.cartItemId !== null);

  const setSpec = async (patch: Parameters<typeof updateSpec>[1]) => {
    try {
      const next = await updateSpec(check.id, patch);
      queryClient.setQueryData(checkKey(check.id), next);
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    }
  };

  const addToCart = async () => {
    if (!configurator || !state) return;
    setBusy("cart");
    try {
      let carted = 0;
      for (const variant of variants) {
        if (variant.current.cartItemId) continue;
        const qty = many ? variantQty(variant.variantNo) : single!;
        const calc = buildCalculateBody(configurator, { ...state, quantities: [qty] });
        const quote = await saveQuote({
          ...calc,
          configuration: { ...calc.configuration, quantities: [qty] },
        } as Parameters<typeof saveQuote>[0]);
        const option = quote.options.find((o) => o.quantity === qty) ?? quote.options[0]!;
        const result = await addCheckedFileToCart(check.id, {
          variantNo: variant.variantNo,
          quoteId: quote.id,
          quoteOptionId: option.id,
        });
        queryClient.setQueryData(checkKey(check.id), result.check);
        carted += 1;
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("customer", "cart") });
      announceCartAdd();
      trackUpload("add_to_cart_with_file", { versions: carted });
      toast.success(t("added"), { action: { label: t("viewCart"), onClick: () => router.push("/cart") } });
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(null);
    }
  };

  const saveAsQuote = async () => {
    if (!configurator || !state || single === null) return;
    setBusy("quote");
    try {
      const calc = buildCalculateBody(configurator, { ...state, quantities: [single] });
      await saveQuote({ ...calc, configuration: { ...calc.configuration, quantities: [single] } } as Parameters<
        typeof saveQuote
      >[0]);
      toast.success(t("quoteSaved"), {
        action: { label: t("viewQuotes"), onClick: () => router.push("/account/quotes") },
      });
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(null);
    }
  };

  const size = configurator?.standardSizes.find((s) => s.code === check.spec.sizeCode) ?? null;
  const material =
    configurator && state?.choices.material?.[0] ? optionsById(configurator).get(state.choices.material[0]) : null;
  const optionLabel = (choice: string) => {
    if (choice === "none") return t("print.none");
    if (choice === "cmyk") return t("print.cmyk");
    if (choice.startsWith("spot:")) {
      const ink = configurator ? optionsById(configurator).get(choice.slice(5)) : undefined;
      return ink ? pick(locale, ink.nameTh, ink.nameEn) : t("print.spot");
    }
    return t("print.spot");
  };
  const unit = t("perPiece");

  return (
    <aside
      aria-labelledby="upload-summary"
      className="rounded-card border-border bg-surface shadow-card flex flex-col gap-3.5 border p-5 min-[1100px]:sticky min-[1100px]:top-24"
    >
      <h3 id="upload-summary" className="text-[1.0625rem] font-semibold">
        {t("title")}
      </h3>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[0.84375rem]">
        <dt className="text-muted">{t("product")}</dt>
        <dd className="m-0 min-w-0 text-end">
          <NativeSelect
            aria-label={t("product")}
            className="h-8 text-[0.8125rem]"
            value={check.spec.productSlug ?? ""}
            onValueChange={(value) => void setSpec({ productSlug: value || null })}
            options={[
              ...(check.spec.productSlug ? [] : [{ value: "", label: t("choose") }]),
              ...products.map((p) => ({ value: p.slug, label: p.name })),
            ]}
          />
        </dd>
        <dt className="text-muted">{t("size")}</dt>
        <dd className="m-0 text-end font-medium tabular-nums">
          {size ? t("sizeValue", { code: size.code, l: size.lengthMm, w: size.widthMm, h: size.heightMm }) : "—"}
        </dd>
        {material ? (
          <>
            <dt className="text-muted">{t("material")}</dt>
            <dd className="m-0 text-end font-medium">{pick(locale, material.nameTh, material.nameEn)}</dd>
          </>
        ) : null}
        <dt className="text-muted">{t("files")}</dt>
        <dd className="m-0 text-end font-medium tabular-nums">{format.number(variants.length)}</dd>
      </dl>

      {side && choices.length ? (
        <div className="bg-bg-subtle rounded-control flex flex-col gap-2 p-3 text-[0.8125rem]">
          <b className="font-semibold">{t("inksTitle")}</b>
          {inks ? (
            <span className="text-muted">
              {inks.process
                ? t("inks.process")
                : inks.spotColours.length
                  ? t("inks.spot", { names: inks.spotColours.join(", ") })
                  : t("inks.black")}
            </span>
          ) : null}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("printMethod")}>
            {choices.map((choice) => {
              const on = choice === chosen;
              const recommended = inks && methodChoice(inks.recommended) === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    if (!side) return;
                    const ids = idsOfChoice(side, choice, []);
                    void setSpec({ printMethod: methodOf(side, ids), printSpotColours: ids.length });
                  }}
                  className={cn(
                    "rounded-control bg-surface focus-visible:ring-focus-ring flex min-w-[4.5rem] flex-col items-start border px-2.5 py-1.5 text-start leading-tight outline-none focus-visible:ring-2",
                    on ? "border-fg ring-fg ring-1" : "border-border-strong",
                  )}
                >
                  {optionLabel(choice)}
                  {recommended ? <small className="text-muted text-[0.71875rem]">{t("matchesFile")}</small> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <b className="text-muted text-[0.8125rem] font-semibold">{many ? t("qtyPerFile") : t("qty")}</b>
        {many ? (
          variants.map((v) => (
            <label key={v.variantNo} className="grid grid-cols-[1fr_auto] items-center gap-2 text-[0.8125rem]">
              <span className="truncate">{v.current.fileName}</span>
              <input
                type="number"
                min={configurator?.quantity.min ?? 1}
                step={50}
                value={variantQty(v.variantNo)}
                onChange={(event) =>
                  setPerVariant((prev) => ({
                    ...prev,
                    [v.variantNo]: Math.max(0, Math.round(Number(event.target.value))),
                  }))
                }
                aria-label={t("qtyFor", { name: v.current.fileName })}
                className="border-border-strong rounded-control bg-surface h-8 w-24 border px-2 text-end tabular-nums"
              />
            </label>
          ))
        ) : (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("qty")}>
            {tiers.map((q) => {
              const step = stepOf(q);
              return (
                <button
                  key={q}
                  type="button"
                  aria-pressed={single === q}
                  onClick={() => setQuantity(q)}
                  className={cn(
                    "rounded-control bg-surface focus-visible:ring-focus-ring flex min-w-[4.5rem] flex-col items-start border px-2.5 py-1.5 text-start text-[0.8125rem] leading-tight outline-none focus-visible:ring-2",
                    single === q ? "border-fg ring-fg ring-1" : "border-border-strong",
                  )}
                >
                  <span className="tabular-nums">{t("pieces", { qty: format.number(q) })}</span>
                  <small className="text-muted text-[0.71875rem] tabular-nums">
                    {step?.unitPrice ? format.thb(step.unitPrice) : step ? t("teamQuote") : "…"}
                  </small>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!check.spec.sizeCode ? (
        <p className="text-muted m-0 text-sm">{t("chooseSize")}</p>
      ) : many ? (
        <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[0.8125rem] tabular-nums">
          {variants.map((v) => {
            const step = stepOf(variantQty(v.variantNo));
            return (
              <div key={v.variantNo} className="contents">
                <dt className="text-muted truncate">{v.current.fileName}</dt>
                <dd className="m-0 text-end">{step?.grossAmount ? format.thb(step.grossAmount) : t("teamQuote")}</dd>
              </div>
            );
          })}
          <dt className="text-muted col-span-2 text-xs">{t("perLineNote")}</dt>
        </dl>
      ) : current?.unitPrice ? (
        <>
          <p className="m-0 text-[2.125rem] leading-none font-bold tabular-nums">
            {format.thb(current.unitPrice)}
            <small className="text-muted ms-1 text-sm font-medium">{unit}</small>
          </p>
          <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[0.8125rem] tabular-nums">
            <dt className="text-muted">{t("goods", { qty: format.number(current.quantity) })}</dt>
            <dd className="m-0 text-end">{format.thb(current.productAmount)}</dd>
            {current.vatAmount ? (
              <>
                <dt className="text-muted">{t("vat")}</dt>
                <dd className="m-0 text-end">{format.thb(current.vatAmount)}</dd>
              </>
            ) : null}
            <dt className="text-[0.9375rem] font-bold">{t("total")}</dt>
            <dd className="m-0 text-end text-[0.9375rem] font-bold">{format.thb(current.grossAmount)}</dd>
          </dl>
        </>
      ) : current ? (
        <div>
          <p className="m-0 text-xl font-bold">{t("quoteNeeded")}</p>
          <p className="text-muted m-0 text-xs">{t("quoteNeededBody")}</p>
        </div>
      ) : (
        <p className="text-muted m-0 text-sm" aria-live="polite">
          {t("pricing")}
        </p>
      )}

      {current ? (
        <div className="text-muted flex flex-col gap-1.5 text-[0.8125rem]">
          {current.leadTimeDays !== null ? (
            <span className="flex gap-2">
              <Icon name="clock" size={16} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
              {current.earliestShipDate
                ? t("leadAndShip", { days: current.leadTimeDays, date: format.date(current.earliestShipDate) })
                : t("lead", { days: current.leadTimeDays })}
            </span>
          ) : null}
          <span className="flex gap-2">
            <Icon name="scale" size={16} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
            {current.toleranceShortagePct && current.toleranceOveragePct
              ? tTol("toleranceQuantity", {
                  shortage: format.percent(current.toleranceShortagePct, 1),
                  overage: format.percent(current.toleranceOveragePct, 1),
                })
              : tTol("standard.quantity")}
            {" · "}
            {current.toleranceDimensionalMm
              ? tTol("toleranceDimensional", { mm: format.number(Number(current.toleranceDimensionalMm)) })
              : tTol("standard.size")}
          </span>
        </div>
      ) : null}

      {blocking && check.done ? (
        <p className="bg-danger-subtle text-danger-subtle-fg rounded-control m-0 flex gap-2 p-2.5 text-[0.8125rem]">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {t("blocked")}
        </p>
      ) : null}

      {inCart ? (
        <Button asChild size="lg" block iconStart="cart">
          <Link href="/cart">{t("goToCart")}</Link>
        </Button>
      ) : instant || !check.spec.sizeCode ? (
        <Button
          size="lg"
          block
          iconStart="cart"
          disabled={blocking || !instant || busy !== null || !configurator}
          loading={busy === "cart"}
          onClick={() => void addToCart()}
        >
          {t("addToCart")}
        </Button>
      ) : (
        <Button asChild size="lg" block>
          <Link href={`/configure/${encodeURIComponent(check.spec.productSlug ?? "")}?design=own_file`}>
            {t("requestQuote")}
          </Link>
        </Button>
      )}
      {!many && instant ? (
        <Button
          variant="secondary"
          block
          disabled={busy !== null}
          loading={busy === "quote"}
          onClick={() => void saveAsQuote()}
        >
          {t("saveQuote")}
        </Button>
      ) : null}
      <p className="text-muted m-0 text-xs">{t("afterNote")}</p>
    </aside>
  );
}
