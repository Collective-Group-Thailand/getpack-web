"use client";

import { useTranslations } from "next-intl";
import { Fragment, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";

/** Approximate size in whole centimetres, sent to the configurator in millimetres (its unit, D-183). */
const CM = /^\d{1,3}(\.\d)?$/;

/**
 * The hero's quick start (F3 page patterns §Home 1, U5.1 T1): type → approximate size → quantity →
 * see the price, landing in that product's configurator with the values filled in and priced there.
 * Only products priced instantly are offered; the configurator still decides the final price and
 * may route to RFQ (D-043).
 */
export function QuickStart({ products }: { products: { slug: string; name: string }[] }) {
  const t = useTranslations("home.quickStart");
  const router = useRouter();
  const [slug, setSlug] = useState(products[0]?.slug ?? "");
  const [size, setSize] = useState({ l: "", w: "", h: "" });
  const [quantity, setQuantity] = useState("1000");
  if (products.length === 0) return null;
  const sized = CM.test(size.l) && CM.test(size.w) && CM.test(size.h);
  const counted = /^\d{1,7}$/.test(quantity);

  function go(event: React.FormEvent) {
    event.preventDefault();
    if (!slug || !counted) return;
    const query = new URLSearchParams({ from: "home", qty: quantity });
    if (sized) {
      query.set("l", String(Math.round(Number(size.l) * 10)));
      query.set("w", String(Math.round(Number(size.w) * 10)));
      query.set("d", String(Math.round(Number(size.h) * 10)));
    }
    router.push(`/configure/${slug}?${query.toString()}`);
  }

  // The board's paper slip: kraft-underlined fields on white, uppercase labels, serif ×.
  const line =
    "h-12 rounded-none border-0 border-b-[1.5px] border-[var(--kraft-3)] bg-transparent px-0.5 text-lg shadow-none focus-visible:border-primary focus-visible:ring-0";
  const label = "text-subtle mb-1 block text-xs font-semibold tracking-[0.1em] uppercase";
  return (
    <form
      onSubmit={go}
      aria-label={t("label")}
      className="border-border bg-surface rounded-[1.375rem] border px-6 pt-6 pb-7 shadow-[0_30px_60px_-36px_rgba(60,40,20,.4)] md:px-7.5"
    >
      <div className="grid items-end gap-7 sm:grid-cols-2 lg:grid-cols-[1.3fr_1.6fr_0.8fr_auto]">
        <label className="block">
          <span className={label}>{t("type")}</span>
          <NativeSelect
            className={line}
            value={slug}
            onValueChange={setSlug}
            options={products.map((p) => ({ value: p.slug, label: p.name }))}
          />
        </label>
        <fieldset>
          <legend className={label}>{t("size")}</legend>
          <div className="text-subtle serif grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2.5 text-xl font-medium">
            {(["l", "w", "h"] as const).map((axis, index) => (
              <Fragment key={axis}>
                {index > 0 ? <span aria-hidden>×</span> : null}
                <Field label={t(`axes.${axis}`)} labelHidden>
                  <Input
                    className={`${line} font-sans`}
                    inputMode="decimal"
                    placeholder={t(`axes.${axis}`)}
                    value={size[axis]}
                    onChange={(event) => setSize((current) => ({ ...current, [axis]: event.target.value.trim() }))}
                  />
                </Field>
              </Fragment>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className={label}>{t("quantity")}</span>
          <Input
            className={line}
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value.trim())}
          />
        </label>
        <Button type="submit" size="lg" shape="pill" iconEnd="arrow-right" disabled={!slug || !counted}>
          {t("go")}
        </Button>
      </div>
    </form>
  );
}
