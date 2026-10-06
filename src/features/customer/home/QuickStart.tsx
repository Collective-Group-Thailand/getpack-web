"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

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

  return (
    <form
      onSubmit={go}
      aria-label={t("label")}
      className="border-border bg-surface shadow-card mt-8 grid gap-3 rounded-2xl border p-4 sm:grid-cols-[1.4fr_2fr_1fr_auto] sm:items-end"
    >
      <Field label={t("type")}>
        <NativeSelect
          value={slug}
          onValueChange={setSlug}
          options={products.map((p) => ({ value: p.slug, label: p.name }))}
        />
      </Field>
      <fieldset className="grid grid-cols-3 gap-2">
        <legend className="mb-1 text-sm font-medium">{t("size")}</legend>
        {(["l", "w", "h"] as const).map((axis) => (
          <Field key={axis} label={t(`axes.${axis}`)}>
            <Input
              inputMode="decimal"
              placeholder={t("cm")}
              value={size[axis]}
              onChange={(event) => setSize((current) => ({ ...current, [axis]: event.target.value.trim() }))}
            />
          </Field>
        ))}
      </fieldset>
      <Field label={t("quantity")}>
        <Input inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value.trim())} />
      </Field>
      <Button type="submit" size="lg" disabled={!slug || !counted}>
        {t("go")}
      </Button>
    </form>
  );
}
