"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { DEFAULT_BLEED_MM } from "@getpack/dieline";

import type { Configurator } from "@/features/customer/configurator/model";
import { activeStage } from "@/features/designer/active-stage";
import type { EditorChromeContext } from "@/features/designer/components/Editor";
import type { PrintRule } from "@/features/designer/lib/checks";
import { useEditor } from "@/features/designer/store/editor";
import { ScanError } from "@/features/shared/files/upload";
import { formatDate, formatPercent, formatTHB } from "@/i18n/format";
import { Link, useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics/track";
import { browserApi } from "@/lib/api/browser";
import { stableIdempotencyKey } from "@/lib/api/idempotency";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";

import { OrderAction } from "@/features/customer/designer/OrderAction";

import { useStudioChecks } from "./checks";
import { compareDecimal } from "./decimal";
import { DesignService } from "./DesignService";
import { studioQuote } from "./pricing";
import { uploadRenders } from "./renders";

type Step = Schemas["QuoteStepDto"];
type Phase = "saving" | "quote" | "renders" | "order" | "printing" | "done";
const PHASES: Phase[] = ["saving", "quote", "renders", "order", "printing"];
const TARGET = /^\d{1,7}(\.\d{1,2})?$/;

export interface OrderSheetProps {
  ctx: EditorChromeContext;
  configurator: Configurator | null;
  rules: PrintRule[];
  quantity: number | null;
  onQuantity: (quantity: number) => void;
  productSlug: string | null;
  /** The customer is a member of a company: its purchase approval may apply at checkout (D-281). */
  companyBuyer: boolean;
  styleFamily?: string;
  printMethod?: "digital" | "offset" | "flexo" | "none";
  onChecks: () => void;
}

/**
 * ⑤ Order (studio-spec §2, U4.6): the order sheet over the studio — never a page reload. The
 * quantity tiers with the lowest price per piece marked, the delivery date of each, what the price
 * includes, the tolerances, a target price and a sample first. Ordering is one step: the version is
 * saved and its quotation kept (`store.studio.saveQuote`, D-277 — checkout charges exactly this
 * price), the studio uploads its renders of the version, `store.studio.order` locks the version,
 * puts it in the cart and queues the server's print file, preflight and digital proof (D-280,
 * ADR-0013); the sheet follows the job, then goes on to the cart or the checkout in place. Blocks
 * must be fixed and warnings accepted first (the final pass). A company buyer can send it for
 * approval with a view link for the approvers (D-281).
 */
export function OrderSheet({
  ctx,
  configurator,
  rules,
  quantity,
  onQuantity,
  productSlug,
  companyBuyer,
  styleFamily,
  printMethod,
  onChecks,
}: OrderSheetProps) {
  const t = useTranslations("studio.orderSheet");
  const locale = useLocale() as "th" | "en";
  const router = useRouter();
  const spec = useEditor((s) => s.spec);
  const { persistence } = ctx;
  const designId = persistence.serverId();
  const checks = useStudioChecks(designId, persistence.versionNo(), rules, false, persistence.versionNo);
  const [target, setTarget] = useState("");
  const [phase, setPhase] = useState<Phase | null>(null);
  const [rendered, setRendered] = useState<{ done: number; total: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  // The server prints only a style-library box (an approved recipe to draw from, `studio.print_unavailable`
  // otherwise): a design drawn on a catalogue product is ordered from the product page with the design
  // attached, and the sheet says so up front instead of after a minute of saving and uploading.
  const catalogueOnly = !spec?.studio?.styleVariantCode;
  const blocked = unavailable || catalogueOnly;
  const [approvalLink, setApprovalLink] = useState<string | null>(null);
  const cancelled = useRef(false);

  const presets = configurator?.quantity.presets ?? [];
  const qty = quantity ?? configurator?.quantity.default ?? presets[0] ?? null;
  const tiers = [...new Set([...(qty ? [qty] : []), ...presets])].sort((a, b) => a - b).slice(0, 10);
  const box = persistence.savedBox;
  const tiersQuote = useQuery({
    queryKey: [
      ...queryKeys.zone("customer"),
      "studio-tiers",
      designId,
      box.versionNo,
      tiers.join(","),
      TARGET.test(target) ? target : "",
    ],
    queryFn: async ({ signal }) =>
      studioQuote(
        designId!,
        {
          quantities: tiers,
          versionNo: box.versionNo!,
          ...(TARGET.test(target) ? { targetPricePerUnit: target } : {}),
        },
        signal,
      ),
    enabled: !!designId && !!box.versionNo && !!box.box?.spec && tiers.length > 0,
    staleTime: 5 * 60_000,
  });
  const steps = tiersQuote.data?.calculation?.steps ?? [];
  const priced = steps.filter((s): s is Step & { unitPrice: string } => s.instant && !!s.unitPrice);
  const best = priced.reduce<string | null>(
    (low, s) => (low === null || compareDecimal(s.unitPrice, low) < 0 ? s.unitPrice : low),
    null,
  );
  const chosen = steps.find((s) => s.quantity === qty) ?? null;
  const gap = tiersQuote.data?.calculation?.target?.steps.find((s) => s.quantity === qty) ?? null;

  const blocks = ctx.issues.filter((i) => i.severity === "block");
  const open = ctx.issues.filter((i) => i.severity === "warn" && !checks.acknowledged(i));
  const ready = blocks.length === 0 && open.length === 0 && !!chosen?.instant;

  const order = async (next: "cart" | "checkout" | "approval") => {
    const stage = activeStage();
    if (!stage || !ctx.dieline || !qty) return;
    cancelled.current = false;
    setProblem(null);
    setUnavailable(false);
    try {
      setPhase("saving");
      if (!(await persistence.save("manual"))) throw new Error(t("saveFailed"));
      const id = persistence.serverId()!;
      const versionNo = persistence.versionNo()!;

      setPhase("quote");
      const { data: quote } = await browserApi().POST("/v1/store/studio/{designId}/quote/actions/save", {
        params: {
          path: { designId: id },
          header: { "Idempotency-Key": await stableIdempotencyKey(`${id}:${versionNo}:quote:${qty}`) },
        },
        body: { quantities: [qty], versionNo, ...(TARGET.test(target) ? { targetPricePerUnit: target } : {}) },
      });
      const option = quote!.options.find((o) => o.quantity === qty) ?? quote!.options[0]!;

      setPhase("renders");
      const sides = spec?.studio?.printSides ?? "outside";
      await uploadRenders(stage, {
        designId: id,
        versionNo,
        dieline: ctx.dieline,
        bleedMm: useEditor.getState().bleedMm ?? DEFAULT_BLEED_MM,
        sides:
          sides === "both"
            ? ["outside", "inside"]
            : sides === "inside"
              ? ["inside"]
              : sides === "none"
                ? []
                : ["outside"],
        onProgress: (done, total) => setRendered({ done, total }),
      });
      await checks.carryAcknowledgements(versionNo, ctx.issues);

      setPhase("order");
      const { data: job } = await browserApi().POST("/v1/store/studio/{designId}/order", {
        params: {
          path: { designId: id },
          header: { "Idempotency-Key": await stableIdempotencyKey(`${id}:${versionNo}:${option.id}`) },
        },
        body: { quoteId: quote!.id, quoteOptionId: option.id, versionNo },
      });

      setPhase("printing");
      let status = job!;
      for (let attempt = 0; attempt < 120 && !cancelled.current; attempt++) {
        if (status.status === "succeeded" || status.status === "failed") break;
        await new Promise((resolve) => setTimeout(resolve, 1500));
        status = (await browserApi().GET("/v1/store/studio/jobs/{jobId}", { params: { path: { jobId: job!.id } } }))
          .data!;
      }
      if (status.status === "failed") throw new Error(status.error ?? t("printFailed"));
      track("studio_add_to_cart", {
        quantity: qty,
        ...(styleFamily ? { styleFamily } : {}),
        ...(printMethod ? { printMethod } : {}),
      });
      setPhase("done");

      if (next === "approval") {
        // The approvers' view link (D-281, D-226 rules: signed, expiring, revocable).
        const { data: link } = await browserApi().POST("/v1/store/designs/{designId}/actions/share", {
          params: { path: { designId: id } },
        });
        setApprovalLink(`${window.location.origin}${locale === "en" ? "/en" : ""}/design/shared/${link!.shareToken}`);
        return;
      }
      router.push(next === "checkout" ? "/checkout" : "/cart");
    } catch (error) {
      if (isApiError(error) && error.code === "studio.print_unavailable") setUnavailable(true);
      else if (isApiError(error) && error.code === "studio.checks_not_ready") setProblem(t("checksNotReady"));
      // A network failure (an upload that never reached storage) is not a message for the customer.
      else if (error instanceof TypeError) setProblem(t("networkFailed"));
      else if (error instanceof ScanError) setProblem(t(error.kind === "timeout" ? "scanPending" : "scanRejected"));
      else setProblem(isApiError(error) ? error.detail : error instanceof Error ? error.message : t("failed"));
      setPhase(null);
    }
  };

  if (!configurator?.instant) return null;

  return (
    <div className="space-y-5">
      <h2 className="font-semibold">{t("title")}</h2>

      {blocks.length || open.length ? (
        <Callout
          tone={blocks.length ? "danger" : "warning"}
          title={t(blocks.length ? "blocks" : "warnings", { count: blocks.length || open.length })}
        >
          <Button size="sm" variant="secondary" className="mt-2" onClick={onChecks}>
            {t("toChecks")}
          </Button>
        </Callout>
      ) : null}

      <section aria-labelledby="order-tiers" className="space-y-2">
        <h3 id="order-tiers" className="text-sm font-semibold">
          {t("tiers")}
        </h3>
        {tiers.length === 0 ? <p className="text-muted text-sm">{t("needsQuantity")}</p> : null}
        <table className="w-full text-sm" hidden={tiers.length === 0}>
          <caption className="sr-only">{t("tiers")}</caption>
          <thead className="text-muted text-xs">
            <tr>
              <th scope="col" className="py-1 text-start font-normal">
                {t("quantity")}
              </th>
              <th scope="col" className="py-1 text-end font-normal">
                {t("perPiece")}
              </th>
              <th scope="col" className="py-1 text-end font-normal">
                {t("total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s) => (
              <tr key={s.quantity} className={s.quantity === qty ? "bg-primary-subtle" : undefined}>
                <th scope="row" className="py-1 text-start font-normal">
                  <button
                    type="button"
                    aria-pressed={s.quantity === qty}
                    onClick={() => onQuantity(s.quantity)}
                    className="focus-visible:ring-focus-ring rounded px-1 underline-offset-2 outline-none hover:underline focus-visible:ring-2"
                  >
                    {t("pieces", { count: s.quantity })}
                  </button>
                  {s.unitPrice && best && compareDecimal(s.unitPrice, best) === 0 && priced.length > 1 ? (
                    <Badge tone="success" className="ms-1">
                      {t("bestValue")}
                    </Badge>
                  ) : null}
                </th>
                <td className="py-1 text-end tabular-nums">
                  {s.unitPrice ? formatTHB(s.unitPrice, locale) : t("onRequest")}
                </td>
                <td className="py-1 text-end tabular-nums">{s.grossAmount ? formatTHB(s.grossAmount, locale) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {tiersQuote.isFetching ? <p className="text-muted text-xs">{t("pricing")}</p> : null}
      </section>

      {chosen?.instant ? (
        <section aria-labelledby="order-details" className="space-y-1 text-sm">
          <h3 id="order-details" className="text-sm font-semibold">
            {t("details")}
          </h3>
          {chosen.earliestDeliveryDate ? (
            <p>
              {t("delivery", { date: formatDate(chosen.earliestDeliveryDate, locale), days: chosen.leadTimeDays ?? 0 })}
            </p>
          ) : null}
          <ul className="text-muted list-disc ps-4 text-xs">
            {chosen.productAmount ? (
              <li>{t("includes.product", { amount: formatTHB(chosen.productAmount, locale) })}</li>
            ) : null}
            {chosen.toolingAmount && !chosen.toolingWaiver ? (
              <li>{t("includes.tooling", { amount: formatTHB(chosen.toolingAmount, locale) })}</li>
            ) : null}
            {chosen.designFeeAmount ? (
              <li>{t("includes.design", { amount: formatTHB(chosen.designFeeAmount, locale) })}</li>
            ) : null}
            {chosen.vatAmount ? <li>{t("includes.vat", { amount: formatTHB(chosen.vatAmount, locale) })}</li> : null}
            <li>
              {chosen.shippingPending
                ? t("includes.shippingPending")
                : chosen.shippingAmount
                  ? t("includes.shipping", { amount: formatTHB(chosen.shippingAmount, locale) })
                  : t("includes.noShipping")}
            </li>
          </ul>
          {chosen.toleranceShortagePct !== null || chosen.toleranceDimensionalMm !== null ? (
            <p className="text-muted text-xs">
              {t("tolerances", {
                // The API's decimal strings ("5.0000"), trimmed for reading — never computed on.
                shortage:
                  chosen.toleranceShortagePct === null ? "—" : formatPercent(chosen.toleranceShortagePct, locale),
                overage: chosen.toleranceOveragePct === null ? "—" : formatPercent(chosen.toleranceOveragePct, locale),
                mm: chosen.toleranceDimensionalMm ?? "—",
              })}
            </p>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="order-target" className="space-y-2">
        <h3 id="order-target" className="text-sm font-semibold">
          {t("target")}
        </h3>
        <Field label={t("targetLabel")} hint={t("targetHint")}>
          <Input inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value.trim())} />
        </Field>
        {gap ? (
          <p className="text-sm" role="status">
            {gap.meetsTarget ? t("targetMet") : t("targetGap", { gap: formatTHB(gap.gapPerUnit, locale) })}
          </p>
        ) : null}
        {productSlug ? (
          <Link href={`/configure/${productSlug}`} className="text-primary text-xs underline">
            {t("levers")}
          </Link>
        ) : null}
      </section>

      <p className="text-sm">
        <Link href="/samples" className="text-primary underline">
          {t("sample")}
        </Link>
      </p>

      {blocked ? (
        <Callout tone="info" title={t("unavailableTitle")}>
          <p className="mb-2 text-sm">{t(catalogueOnly ? "catalogueBody" : "unavailableBody")}</p>
          <OrderAction link={null} productSlug={productSlug} />
        </Callout>
      ) : null}
      {problem ? <Callout tone="danger" title={problem} /> : null}

      <div className="flex flex-col gap-2">
        <Button disabled={!ready || phase !== null || blocked} onClick={() => void order("checkout")}>
          {t("orderNow")}
        </Button>
        <Button
          variant="secondary"
          disabled={!ready || phase !== null || blocked}
          onClick={() => void order("cart")}
        >
          {t("addToCart")}
        </Button>
        {companyBuyer ? (
          <Button
            variant="ghost"
            disabled={!ready || phase !== null || blocked}
            onClick={() => void order("approval")}
          >
            {t("sendForApproval")}
          </Button>
        ) : null}
      </div>

      <DesignService
        ctx={ctx}
        quantity={qty}
        offered={configurator?.design.options.includes("hired_design") ?? false}
      />

      <Dialog
        open={phase !== null && phase !== "done"}
        onOpenChange={(openNow) => {
          if (!openNow) cancelled.current = true;
        }}
        title={t("progressTitle")}
        description={t("progressBody")}
        size="sm"
      >
        <ol className="space-y-2" aria-live="polite">
          {PHASES.map((p) => {
            const index = PHASES.indexOf(p);
            const at = phase ? PHASES.indexOf(phase as (typeof PHASES)[number]) : -1;
            return (
              <li key={p} className="flex items-center justify-between gap-2 text-sm">
                <span className={index > at ? "text-muted" : undefined}>{t(`phases.${p}`)}</span>
                <span className="text-muted text-xs">
                  {index < at ? t("phaseDone") : index === at ? t("phaseNow") : null}
                </span>
              </li>
            );
          })}
        </ol>
        {phase === "renders" && rendered ? (
          <p className="text-muted mt-3 text-xs">{t("renderCount", { done: rendered.done, total: rendered.total })}</p>
        ) : null}
      </Dialog>

      <Dialog
        open={approvalLink !== null}
        onOpenChange={(openNow) => !openNow && setApprovalLink(null)}
        title={t("approvalTitle")}
        description={t("approvalBody")}
        size="md"
        footer={<Button onClick={() => router.push("/checkout")}>{t("toCheckout")}</Button>}
      >
        <Field label={t("approvalLink")}>
          <Input readOnly value={approvalLink ?? ""} onFocus={(event) => event.target.select()} />
        </Field>
      </Dialog>
    </div>
  );
}
