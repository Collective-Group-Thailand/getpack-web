"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { Configurator } from "@/features/customer/configurator/model";
import type { Persistence } from "@/features/designer/data/persistence";
import { useEditor } from "@/features/designer/store/editor";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";

import { CmykPriceConfirm } from "./CmykPriceConfirm";
import { spotShortfall } from "./state";

/**
 * Never trim spot colours silently (C0): when the artwork has more flat colours than the spec's
 * price covers — the flexo limit, the product's inks or a corrugate side's print model — the
 * Studio says so and offers the ways out the product has: "เปลี่ยนเป็น CMYK" (a full-colour
 * method) and "เพิ่มจำนวนสี" (one spot ink per colour, flexo, within the limit). On corrugate (C0b)
 * "เพิ่มจำนวนสี" keeps every colour and leads to the quote path: the price dock then offers
 * "ขอใบเสนอราคา" with the spec (the calculation answers `rfq_required`).
 * C11 (D-459): "เปลี่ยนเป็น CMYK" first shows the price now and with CMYK (`CmykPriceConfirm`); it applies on confirm.
 */
export function SpotColourWarning({
  configurator,
  maxSpot,
  quantity = null,
  persistence = null,
}: {
  configurator: Configurator | null;
  maxSpot: number | null;
  /** The dock's quantity, so the CMYK price is shown at the quantity on screen. */
  quantity?: number | null;
  /** The saved design (signed in), priced through `store.studio.quote`; `null` for a guest. */
  persistence?: Persistence | null;
}) {
  const t = useTranslations("studio.spotShortfall");
  const spec = useEditor((s) => s.spec);
  const content = useEditor((s) => s.content);
  const [confirming, setConfirming] = useState(false);
  if (!configurator || !spec) return null;
  const gap = spotShortfall(configurator, spec, content, maxSpot);
  if (!gap) return null;
  const setMethod = (printMethod: "digital" | "flexo") => {
    const now = useEditor.getState().spec;
    if (now) useEditor.getState().setSpec({ ...now, studio: { ...now.studio, printMethod } });
  };
  return (
    <Callout tone="warning" live title={t("title")} className="max-w-xl" data-spot-shortfall="">
      <p>{t("body", { needed: gap.needed, priced: gap.priced })}</p>
      {gap.more && gap.quote ? <p className="mt-1">{t("moreQuote")}</p> : null}
      {gap.cmyk || gap.more ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {gap.cmyk ? (
            <Button size="sm" variant="secondary" onClick={() => setConfirming(true)} data-to-cmyk="">
              {t("toCmyk")}
            </Button>
          ) : null}
          {gap.more ? (
            <Button size="sm" variant="secondary" onClick={() => setMethod("flexo")}>
              {t("moreColours")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {gap.cmyk ? (
        <CmykPriceConfirm
          open={confirming}
          onOpenChange={setConfirming}
          onConfirm={() => {
            setConfirming(false);
            setMethod("digital");
          }}
          configurator={configurator}
          maxSpot={maxSpot}
          quantity={quantity}
          persistence={persistence}
        />
      ) : null}
    </Callout>
  );
}
