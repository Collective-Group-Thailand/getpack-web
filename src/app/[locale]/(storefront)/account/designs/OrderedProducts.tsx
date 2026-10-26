"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { studioHref } from "@/features/customer/studio/paths";
import { storeDesigns, type StoreDesign } from "@/features/designer/data/api";
import { formatDateTime } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { toast } from "@/ui/components/Toast";

/**
 * My products (U4.8, studio-spec §4): every design an order locked, as a product — its style code,
 * size, product and the artwork version that was made — reordered in one click (the order's reorder,
 * F3 3.6), ordered again in another quantity only (the studio's order sheet on that design), or
 * duplicated to a new size (a copy opened on ②, where the artwork is fitted to the new size and the
 * checks run again).
 */
export function OrderedProducts({ designs }: { designs: StoreDesign[] }) {
  const t = useTranslations("designs.products");
  const locale = useLocale() as "th" | "en";
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const ordered = designs.filter((design) => design.lock);
  if (!ordered.length) return null;

  const newSize = async (design: StoreDesign) => {
    setBusy(design.id);
    try {
      const copy = await storeDesigns.duplicate(design.id, t("copyName", { name: design.title }), crypto.randomUUID());
      router.push(`${locale === "en" ? "/en" : ""}${studioHref({ designId: copy.data.id, step: "box" })}`);
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="my-products" className="mb-10 space-y-4">
      <div>
        <h2 id="my-products" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <p className="text-muted text-sm">{t("body")}</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((design) => {
          const lock = design.lock!;
          const product = locale === "en" ? design.product.nameEn : design.product.nameTh;
          const size =
            design.lengthMm && design.widthMm && design.heightMm
              ? t("size", { l: design.lengthMm, w: design.widthMm, h: design.heightMm })
              : null;
          return (
            <Card as="li" key={design.id} className="space-y-3">
              <div>
                <p className="font-medium">{design.title}</p>
                <p className="text-muted text-xs">{[product, size].filter(Boolean).join(" · ")}</p>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                {design.styleVariantCode ? (
                  <>
                    <dt className="text-muted">{t("styleCode")}</dt>
                    <dd className="tabular-nums">{design.styleVariantCode}</dd>
                  </>
                ) : null}
                <dt className="text-muted">{t("artwork")}</dt>
                <dd>{t("version", { version: lock.versionNo })}</dd>
                <dt className="text-muted">{t("lastOrder")}</dt>
                <dd>
                  <Link
                    href={`/account/orders/${lock.orderId}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {lock.orderCode}
                  </Link>{" "}
                  <span className="text-muted">{formatDateTime(lock.lockedAt, locale)}</span>
                </dd>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" iconStart="refresh">
                  <Link
                    href={`/account/orders/${lock.orderId}/reorder`}
                    aria-label={t("reorderLabel", { name: design.title })}
                  >
                    {t("reorder")}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link
                    href={studioHref({ designId: design.id, step: "order" })}
                    aria-label={t("quantityLabel", { name: design.title })}
                  >
                    {t("quantity")}
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy === design.id}
                  aria-label={t("newSizeLabel", { name: design.title })}
                  onClick={() => void newSize(design)}
                >
                  {t("newSize")}
                </Button>
              </div>
              {design.lock && design.versionNo && design.versionNo > lock.versionNo ? (
                <Badge tone="neutral">{t("editedSince", { version: design.versionNo })}</Badge>
              ) : null}
            </Card>
          );
        })}
      </ul>
    </section>
  );
}
