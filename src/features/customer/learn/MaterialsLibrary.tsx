"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";

import { GlossaryChip } from "./GlossaryChip";
import type { Material } from "./api.server";

const MAX_COMPARE = 3;

/**
 * The materials library (U5.6 §1): every material with the spec data the API holds — thickness,
 * grammage or flute, how it prints, food contact, recyclability — a side-by-side comparison of up
 * to three, and "ใช้วัสดุนี้" straight into a configurator with it chosen. A figure the API does
 * not have is shown as "—", never guessed.
 */
export function MaterialsLibrary({ materials }: { materials: Material[] }) {
  const t = useTranslations("help.materials");
  const locale = useLocale();
  const format = useFormat();
  const [compare, setCompare] = useState<string[]>([]);
  const chosen = materials.filter((m) => compare.includes(m.code));

  const toggle = (code: string, on: boolean) =>
    setCompare((current) => (on ? [...current, code].slice(-MAX_COMPARE) : current.filter((c) => c !== code)));

  const facts = (m: Material) => [
    { key: "caliper", value: m.caliperMm !== null ? t("mm", { value: format.number(m.caliperMm) }) : "—" },
    { key: "gsm", value: m.gsm !== null ? t("gsmValue", { value: format.number(m.gsm) }) : "—", chip: "gsm" },
    { key: "flute", value: m.flute ?? "—", chip: "e-flute" },
    { key: "print", value: m.printMethods.map((p) => pick(locale, p.nameTh, p.nameEn)).join(", ") || "—" },
    { key: "food", value: t(`food.${m.foodContact}`) },
    { key: "recycle", value: t(`recycle.${m.recyclability}`) },
  ];

  return (
    <div className="flex flex-col gap-6">
      {chosen.length > 0 ? (
        <section aria-labelledby="compare" className="border-primary/30 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="compare" className="font-semibold">
              {t("compareTitle", { count: chosen.length })}
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setCompare([])}>
              {t("clearCompare")}
            </Button>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <caption className="sr-only">{t("compareTitle", { count: chosen.length })}</caption>
              <thead>
                <tr>
                  <th scope="col" className="text-muted w-40 text-start font-normal">
                    <span className="sr-only">{t("property")}</span>
                  </th>
                  {chosen.map((m) => (
                    <th key={m.code} scope="col" className="text-start font-semibold">
                      {pick(locale, m.nameTh, m.nameEn)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {facts(chosen[0]!).map((row, index) => (
                  <tr key={row.key} className="border-border border-t">
                    <th scope="row" className="text-muted py-2 text-start font-normal">
                      {t(`facts.${row.key}`)}
                    </th>
                    {chosen.map((m) => (
                      <td key={m.code} className="py-2">
                        {facts(m)[index]!.value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2">
        {materials.map((m) => {
          const offer = m.offeredOn[0];
          const selected = compare.includes(m.code);
          return (
            <li key={m.code} className="border-border flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{pick(locale, m.nameTh, m.nameEn)}</h2>
                  <p className="text-muted text-xs">{t(`kinds.${m.kind}`)}</p>
                </div>
                {m.foodContact === "approved" ? <Badge tone="success">{t("food.approved")}</Badge> : null}
              </div>
              {m.descriptionTh ? (
                <p className="text-muted text-sm">{pick(locale, m.descriptionTh, m.descriptionEn)}</p>
              ) : null}
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                {facts(m).map((row) => (
                  <div key={row.key} className="contents">
                    <dt className="text-muted">
                      {t(`facts.${row.key}`)}
                      {row.chip && row.value !== "—" ? <GlossaryChip slug={row.chip} /> : null}
                    </dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                <Checkbox
                  label={
                    <>
                      {t("compare")}
                      <span className="sr-only"> {pick(locale, m.nameTh, m.nameEn)}</span>
                    </>
                  }
                  checked={selected}
                  onCheckedChange={(on) => toggle(m.code, on === true)}
                />
                {offer ? (
                  <Button asChild size="sm">
                    <Link
                      href={`/configure/${offer.productSlug}?material=${encodeURIComponent(offer.materialOptionId)}`}
                    >
                      {t("use")}
                    </Link>
                  </Button>
                ) : (
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/help/chat">{t("askAbout")}</Link>
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
