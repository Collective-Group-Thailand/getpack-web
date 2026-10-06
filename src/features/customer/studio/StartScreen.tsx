"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { ProductPlate, type ProductFamily } from "@/ui/components/ProductIllustration";

import { SampleDesignLink } from "./SampleDesign";

type Intent = "box" | "product" | "file" | "reorder";

const FAMILY: Record<Intent, ProductFamily> = {
  box: "tuck",
  product: "shipping",
  file: "service",
  reorder: "stock",
};

/**
 * The studio's first screen (UX audit, studio: "หน้าเริ่มต้นเป็นหน้าเต็ม ไม่มี canvas ว่าง"): what
 * brings you here, as four large cards — choose a box and design it here; you have the product
 * (size it in the configurator); you have a finished file; reorder — then your recent designs and
 * a sample box to play with. It fills the canvas until a box is chosen.
 */
export function StartScreen({
  onChooseBox,
  productSlug,
  signedIn,
}: {
  onChooseBox: () => void;
  productSlug: string | null;
  signedIn: boolean;
}) {
  const t = useTranslations("studio.startScreen");
  const configure = productSlug ? `/configure/${productSlug}` : "/products";
  const card =
    "group border-border bg-surface rounded-card hover:shadow-lift focus-visible:ring-focus-ring flex h-full flex-col gap-3 border p-5 text-start transition-shadow outline-none focus-visible:ring-2";
  const plate = (intent: Intent) => <ProductPlate family={FAMILY[intent]} className="rounded-xl" />;
  const body = (intent: Intent) => (
    <>
      {plate(intent)}
      <span className="text-lg font-semibold">{t(`${intent}.title`)}</span>
      <span className="text-muted text-sm leading-relaxed">{t(`${intent}.body`)}</span>
    </>
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <p className="text-muted mt-2">{t("lead")}</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <li>
          <button type="button" onClick={onChooseBox} className={card}>
            {body("box")}
          </button>
        </li>
        <li>
          <Link href={configure} className={card}>
            {body("product")}
          </Link>
        </li>
        <li>
          <Link href={configure} className={card}>
            {body("file")}
          </Link>
        </li>
        <li>
          <Link href={signedIn ? "/account/orders" : "/sign-in?returnTo=%2Faccount%2Forders"} className={card}>
            {body("reorder")}
          </Link>
        </li>
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {signedIn ? (
          <Link href="/account/designs" className="text-primary text-sm font-medium hover:underline">
            {t("recent")}
          </Link>
        ) : (
          <span />
        )}
        <SampleDesignLink productSlug={productSlug} />
      </div>
    </div>
  );
}
