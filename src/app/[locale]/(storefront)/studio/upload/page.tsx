import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { listProducts } from "@/features/customer/catalog/api.server";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { HOME_WRAP } from "@/features/customer/home/parts";
import { STYLES_HREF } from "@/features/customer/styles/paths";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { ProductThumb, productFamilyOf } from "@/ui/components/ProductIllustration";
import { cn } from "@/ui/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("studio.upload");
  return { title: t("metaTitle") };
}

const UNDERLINE = "border-b border-current pb-px font-medium";

/**
 * `/studio/upload` — "มีไฟล์แล้ว อัปโหลดเลย" (Phase 4): the customer with a finished file picks what
 * they print and lands in its configurator with "own file" chosen (`?design=own_file`), where the
 * price is. The file itself is uploaded after ordering, on the order's artwork page, and the team
 * checks it before production — the copy says only that until the upload pre-check ships
 * (upload-redesign Phase 2, GLOBAL-RULES §3). Only products with an instant price are listed; the
 * rest go through RFQ.
 */
export default async function StudioUpload({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, format, products] = await Promise.all([
    getTranslations("studio.upload"),
    getFormat(),
    listProducts({ perPage: 48 }).catch(() => null),
  ]);
  const priced = (products?.data ?? []).filter((product) => product.availability !== "rfq");

  return (
    <div className={cn(HOME_WRAP, "pt-10 pb-20 md:pt-14")}>
      <div className="max-w-[46rem]">
        <h1 className="text-[2.125rem] leading-[1.1] md:text-5xl">{t("title")}</h1>
        <p className="text-muted mt-4 text-[1.0625rem]">{t("lead")}</p>
        <ol className="border-fg mt-8 grid gap-4 border-t pt-4 text-[0.90625rem] sm:grid-cols-3">
          {(["pick", "spec", "file"] as const).map((step, index) => (
            <li key={step}>
              <b className="block font-semibold tabular-nums">{index + 1}</b>
              <span className="text-muted">{t(`steps.${step}`)}</span>
            </li>
          ))}
        </ol>
      </div>

      <section aria-labelledby="upload-pick" className="mt-14">
        <h2 id="upload-pick" className="text-[1.75rem] leading-tight">
          {t("pick")}
        </h2>
        {priced.length > 0 ? (
          <ul className="mt-5 grid gap-x-5 sm:grid-cols-2 lg:grid-cols-4">
            {priced.map((product) => {
              const name = pick(locale, product.nameTh, product.nameEn);
              const src = storeImageSrc(product.imageUrl, "thumb");
              const facts = [
                product.startingPricePerPiece ? t("from", { price: format.thb(product.startingPricePerPiece) }) : null,
                product.moq !== null ? t("moq", { count: format.number(product.moq) }) : null,
              ].filter(Boolean);
              return (
                <li key={product.slug}>
                  <Link
                    href={`/configure/${encodeURIComponent(product.slug)}?design=own_file`}
                    className="border-border hover:text-primary grid grid-cols-[4.5rem_1fr] items-center gap-3.5 border-t py-4"
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element -- API-origin image (see ProductCard)
                      <img src={src} alt="" width={72} height={72} loading="lazy" className="size-18 object-cover" />
                    ) : (
                      <ProductThumb
                        family={productFamilyOf(product.productTypeCode)}
                        className="size-18 rounded-none [&_svg]:max-w-14"
                      />
                    )}
                    <span>
                      <b className="block text-[0.9375rem] font-semibold">{name}</b>
                      {facts.length ? <span className="text-muted text-[13px]">{facts.join(" · ")}</span> : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="border-border mt-5 flex flex-wrap items-center gap-4 border-y py-5">
            <p className="text-muted">{t("none")}</p>
            <Button asChild variant="secondary">
              <Link href="/contact">{t("contact")}</Link>
            </Button>
          </div>
        )}
        <p className="text-muted mt-6 text-[13px]">
          {t.rich("noFile", {
            studio: (chunks) => (
              <Link href="/studio" className={cn("text-fg", UNDERLINE)}>
                {chunks}
              </Link>
            ),
            templates: (chunks) => (
              <Link href={STYLES_HREF} className={cn("text-fg", UNDERLINE)}>
                {chunks}
              </Link>
            ),
          })}
        </p>
      </section>
    </div>
  );
}
