"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/i18n/format";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

import { documentColours, isBlackInk, recolour } from "../../lib/ink";
import { useEditor } from "../../store/editor";
import { readBrandKit, saveBrandKit } from "./brand-kit";

/**
 * "สีในงาน" (pro, Phase 3 item 5): every flat colour the design uses on both sides, with how often; changing one
 * recolours the whole job in one undo step; "+ แบรนด์" keeps it in the brand kit; the ink count beside the print
 * mode chosen. No CMYK figures: the browser has no ICC profile to convert with, and a guessed value would read as a
 * print value (GLOBAL-RULES §3) — brand-kit colours keep the CMYK the customer entered.
 */
export function ColoursPanel({ printLabel }: { printLabel: string | null }) {
  const t = useTranslations("designer.shell.colours");
  const locale = useLocale() as "th" | "en";
  const content = useEditor((s) => s.content);
  const colours = documentColours(content);
  const [brand, setBrand] = useState<string[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is read after mount
    setBrand(readBrandKit().colours.map((c) => c.toLowerCase()));
  }, []);
  const black = colours.some((c) => isBlackInk(c.colour));
  const others = colours.filter((c) => !isBlackInk(c.colour) && c.colour !== "#ffffff").length;

  const keep = (hex: string) => {
    const kit = readBrandKit();
    if (kit.colours.some((c) => c.toLowerCase() === hex)) return;
    saveBrandKit({ ...kit, colours: [...kit.colours, hex] });
    setBrand((b) => [...b, hex]);
    toast.success(t("kept", { hex: hex.toUpperCase() }));
  };

  if (!colours.length) return <p className="text-muted text-sm">{t("empty")}</p>;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted -mt-1 text-xs">{t("body")}</p>
      <ul className="flex flex-col">
        {colours.map(({ colour, uses }) => (
          <li
            key={colour}
            className="border-border grid grid-cols-[34px_1fr_auto] items-center gap-2.5 border-b py-1.5"
          >
            <label
              title={t("change", { hex: colour.toUpperCase() })}
              className="relative block size-[34px] cursor-pointer rounded-lg border border-black/15"
              style={{ backgroundColor: colour }}
            >
              <span className="sr-only">{t("change", { hex: colour.toUpperCase() })}</span>
              <SwapInput colour={colour} />
            </label>
            <div className="min-w-0 text-xs">
              <b className="text-fg block text-[13px] font-semibold tabular-nums">{colour.toUpperCase()}</b>
              <span className="text-muted">
                {t("uses", { count: uses, n: formatNumber(uses, locale) })}
                {isBlackInk(colour) ? ` · ${t("blackInk")}` : null}
              </span>
            </div>
            {brand.includes(colour) ? (
              <span className="text-muted text-xs">{t("inKit")}</span>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => keep(colour)}>
                {t("keep")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <section aria-labelledby="ink-count" className="flex flex-col gap-2">
        <h3 id="ink-count" className="text-muted text-xs font-semibold">
          {t("inks")}
        </h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
          <dt className="text-muted">{t("black")}</dt>
          <dd className="text-end">{black ? t("yes") : t("no")}</dd>
          <dt className="text-muted">{t("others")}</dt>
          <dd className="text-end tabular-nums">{t("otherCount", { count: others })}</dd>
          {printLabel ? (
            <>
              <dt className="text-muted">{t("print")}</dt>
              <dd className="text-end">{printLabel}</dd>
            </>
          ) : null}
        </dl>
      </section>
    </div>
  );
}

/** The colour picker of one row: the job is recoloured once the picker commits (one undo step), not while dragging. */
function SwapInput({ colour }: { colour: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    const onChange = () => useEditor.getState().commit((c) => recolour(c, colour, input.value));
    input.addEventListener("change", onChange);
    return () => input.removeEventListener("change", onChange);
  }, [colour]);
  return <input ref={ref} type="color" defaultValue={colour} className="absolute inset-0 cursor-pointer opacity-0" />;
}
