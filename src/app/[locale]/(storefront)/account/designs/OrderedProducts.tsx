"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { studioHref } from "@/features/customer/studio/paths";
import { storeDesigns, type StoreDesign } from "@/features/designer/data/api";
import { formatDateTime } from "@/i18n/format";
import { DesignThumb } from "@/features/customer/account/DesignThumb";
import { Link } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";
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
  const tDesigns = useTranslations("designs");
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
    <section aria-labelledby="my-products" className="mb-8 space-y-4">
      <div>
        <h2 id="my-products" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <p className="text-muted text-sm">{t("body")}</p>
      </div>
      <ul className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {ordered.map((design) => {
          const lock = design.lock!;
          const product = locale === "en" ? design.product.nameEn : design.product.nameTh;
          const size =
            design.lengthMm && design.widthMm && design.heightMm
              ? t("size", { l: design.lengthMm, w: design.widthMm, h: design.heightMm })
              : null;
          return (
            <li
              key={design.id}
              className="border-border bg-surface rounded-card flex h-full min-w-0 flex-col overflow-hidden border"
            >
              <Link
                href={studioHref({ designId: design.id })}
                className="bg-surface-subtle border-border block aspect-[4/3] border-b"
                tabIndex={-1}
                aria-hidden={Boolean(design.thumbnailUrl || design.thumbnailFileId)}
              >
                <DesignThumb
                  url={design.thumbnailUrl}
                  fileId={design.thumbnailFileId}
                  empty={tDesigns("card.noThumbnail")}
                />
              </Link>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="min-w-0">
                  <p className="line-clamp-2 font-semibold [overflow-wrap:break-word] break-keep">{design.title}</p>
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
                      className="text-primary tabular-nums underline-offset-4 hover:underline"
                    >
                      {lock.orderCode}
                    </Link>
                    <span className="text-muted block">{formatDateTime(lock.lockedAt, locale)}</span>
                  </dd>
                </dl>
                {design.lock && design.versionNo && design.versionNo > lock.versionNo ? (
                  <p>
                    <Badge tone="neutral">{t("editedSince", { version: design.versionNo })}</Badge>
                  </p>
                ) : null}
                <div className="mt-auto flex items-center gap-2 pt-1">
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
                  <span className="ms-auto">
                    <DropdownMenu
                      label={tDesigns("moreActions", { name: design.title })}
                      items={[
                        {
                          id: "new-size",
                          label: t("newSize"),
                          icon: "ruler",
                          disabled: busy === design.id,
                          onSelect: () => void newSize(design),
                        },
                      ]}
                      trigger={
                        <IconButton
                          name="more"
                          size="sm"
                          variant="ghost"
                          loading={busy === design.id}
                          label={tDesigns("moreActions", { name: design.title })}
                        />
                      }
                    />
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
