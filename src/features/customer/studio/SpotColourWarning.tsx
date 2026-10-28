"use client";

import { useTranslations } from "next-intl";

import type { Configurator } from "@/features/customer/configurator/model";
import { useEditor } from "@/features/designer/store/editor";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";

import { spotShortfall } from "./state";

/**
 * Never trim spot colours silently (C0): when the artwork has more flat colours than the spec's
 * price covers — the flexo limit, the product's inks or a corrugate side's print model — the
 * Studio says so and offers the ways out the product has: "เปลี่ยนเป็น CMYK" (a full-colour
 * method) and "เพิ่มจำนวนสี" (one spot ink per colour, flexo, within the limit). On corrugate (C0b)
 * "เพิ่มจำนวนสี" keeps every colour and leads to the quote path: the price dock then offers
 * "ขอใบเสนอราคา" with the spec (the calculation answers `rfq_required`).
 */
export function SpotColourWarning({
  configurator,
  maxSpot,
}: {
  configurator: Configurator | null;
  maxSpot: number | null;
}) {
  const t = useTranslations("studio.spotShortfall");
  const spec = useEditor((s) => s.spec);
  const content = useEditor((s) => s.content);
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
            <Button size="sm" variant="secondary" onClick={() => setMethod("digital")}>
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
    </Callout>
  );
}
