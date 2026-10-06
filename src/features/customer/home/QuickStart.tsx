"use client";

import { useTranslations } from "next-intl";
import { Fragment, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Icon } from "@/ui/icons";

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
      className="border-border bg-surface shadow-overlay rounded-2xl border p-5 md:px-6 md:pt-5.5 md:pb-6"
    >
      <p className="text-primary mb-3.5 flex items-center gap-1.5 text-xs font-semibold">
        <Icon name="calculator" size={16} />
        {t("heading")}
      </p>
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_1.7fr_0.8fr_auto]">
        <Field label={t("type")}>
          <NativeSelect
            className="bg-bg h-12 text-base"
            value={slug}
            onValueChange={setSlug}
            options={products.map((p) => ({ value: p.slug, label: p.name }))}
          />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{t("size")}</legend>
          <div className="text-subtle grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1.5">
            {(["l", "w", "h"] as const).map((axis, index) => (
              <Fragment key={axis}>
                {index > 0 ? <span aria-hidden>×</span> : null}
                <Field label={t(`axes.${axis}`)} labelHidden>
                  <Input
                    inputSize="lg"
                    className="bg-bg text-base"
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
        <Field label={t("quantity")}>
          <Input
            inputSize="lg"
            className="bg-bg text-base"
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value.trim())}
          />
        </Field>
        <Button type="submit" size="lg" iconEnd="arrow-right" className="rounded-xl" disabled={!slug || !counted}>
          {t("go")}
        </Button>
      </div>
    </form>
  );
}
