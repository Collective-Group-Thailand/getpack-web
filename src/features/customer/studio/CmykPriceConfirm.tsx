"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import { buildCalculateBody } from "@/features/customer/configurator/build";
import type { Configurator } from "@/features/customer/configurator/model";
import { calculate } from "@/features/customer/configurator/pricing";
import type { Persistence } from "@/features/designer/data/persistence";
import { useEditor } from "@/features/designer/store/editor";
import type { DesignSpec } from "@/features/designer/types";
import { formatTHB } from "@/i18n/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Spinner } from "@/ui/components/Spinner";

import { studioQuote } from "./pricing";
import { studioFieldsOf } from "./spec";
import { stateForDesign } from "./state";

type Step = Schemas["QuoteStepDto"];

/** The design's spec with the print switched to CMYK ("digital", the full-colour method), nothing else changed. */
export function withCmyk(spec: DesignSpec): DesignSpec {
  return { ...spec, studio: { ...spec.studio, printMethod: "digital" } };
}

/** The step of a calculation at the quantity shown (else its first). */
export const stepAt = (steps: Step[] | undefined, quantity: number): Step | null =>
  steps?.find((s) => s.quantity === quantity) ?? steps?.[0] ?? null;

/**
 * "เปลี่ยนเป็น CMYK" shows the price before it is applied (C11, D-459): the price now and with CMYK, at the dock's
 * quantity, both from the API — a saved design through `store.studio.quote` (the version's own spec, then the same
 * version with `alternativeSpec`: nothing saved), a guest's design (or a saved box not yet matching the screen)
 * through `store.quotes.calculate`. Nothing is computed here (no difference is worked out in the browser); the
 * switch happens only on confirm.
 */
export function CmykPriceConfirm({
  open,
  onOpenChange,
  onConfirm,
  configurator,
  maxSpot,
  quantity,
  persistence,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  configurator: Configurator;
  maxSpot: number | null;
  quantity: number | null;
  /** The saved design (signed in): priced as the Studio prices it; `null` for a guest. */
  persistence: Persistence | null;
}) {
  const t = useTranslations("studio.spotShortfall.cmykConfirm");
  const locale = useLocale() as "th" | "en";
  const spec = useEditor((s) => s.spec);
  const content = useEditor((s) => s.content);
  const qty = quantity ?? configurator.quantity.default ?? null;

  const enabled = open && !!spec && !!qty && configurator.instant;
  const prices = useQuery({
    queryKey: [...queryKeys.zone("customer"), "studio-cmyk-preview", configurator.catalogProductId, qty, open],
    enabled,
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const cmykSpec = withCmyk(spec!);
      const designId = persistence?.serverId() ?? null;
      const versionNo = persistence?.savedBox.versionNo ?? null;
      const cmykFields = studioFieldsOf(configurator, cmykSpec, content, maxSpot);
      if (designId && versionNo && cmykFields) {
        try {
          const now = await studioQuote(designId, { quantities: [qty!], versionNo }, signal);
          const cmyk = await studioQuote(
            designId,
            { quantities: [qty!], versionNo, previousSpecHash: now.specHash, alternativeSpec: cmykFields.spec },
            signal,
          );
          return { now: stepAt(now.calculation?.steps, qty!), cmyk: stepAt(cmyk.calculation?.steps, qty!) };
        } catch (error) {
          // A saved box behind the screen (studio.spec_mismatch): the screen's spec, priced directly.
          if (signal.aborted) throw error;
        }
      }
      const [now, cmyk] = await Promise.all([
        calculate(
          buildCalculateBody(configurator, stateForDesign(configurator, spec!, content, qty!, maxSpot)),
          signal,
        ),
        calculate(
          buildCalculateBody(configurator, stateForDesign(configurator, cmykSpec, content, qty!, maxSpot)),
          signal,
        ),
      ]);
      return { now: stepAt(now.steps, qty!), cmyk: stepAt(cmyk.steps, qty!) };
    },
  });

  const line = (step: Step | null | undefined) =>
    step?.instant && step.unitPrice && step.grossAmount ? (
      <span className="tabular-nums">
        {t("perPiece", { price: formatTHB(step.unitPrice, locale) })}
        <span className="text-muted block text-xs">{t("total", { amount: formatTHB(step.grossAmount, locale) })}</span>
      </span>
    ) : step ? (
      <span>{t("onRequest")}</span>
    ) : (
      <span className="text-muted">{t("noPrice")}</span>
    );

  return (
    <AlertDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("body")}
      confirmLabel={t("confirm")}
      cancelLabel={t("cancel")}
      onConfirm={onConfirm}
    >
      <div className="mt-4" data-cmyk-preview="" aria-live="polite">
        {qty ? <p className="text-muted mb-2 text-xs tabular-nums">{t("atQuantity", { quantity: qty })}</p> : null}
        {enabled && prices.isPending ? (
          <p className="flex items-center gap-2 text-sm" role="status">
            <Spinner size={16} label={null} />
            {t("calculating")}
          </p>
        ) : prices.isError ? (
          <p className="text-muted text-sm" role="status">
            {t("failed")}
          </p>
        ) : (
          <dl className="divide-border border-border divide-y rounded-lg border text-sm">
            <div className="flex items-start justify-between gap-4 px-3 py-2.5">
              <dt>{t("now")}</dt>
              <dd className="text-end" data-price="now">
                {line(prices.data?.now)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 px-3 py-2.5">
              <dt className="font-medium">{t("withCmyk")}</dt>
              <dd className="text-end font-medium" data-price="cmyk">
                {line(prices.data?.cmyk)}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </AlertDialog>
  );
}
