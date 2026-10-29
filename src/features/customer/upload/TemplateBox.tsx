"use client";

import { getStyle } from "@getpack/dieline";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { BoxPreview } from "@/features/designer/components/BoxPreview";
import { trackUpload } from "@/lib/analytics";
import { Button } from "@/ui/components/Button";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Skeleton } from "@/ui/components/Skeleton";

import { useConfigurator } from "./api";
import { referenceMaterial, templatePdf, templateStyleOf } from "./template";
import type { UploadProduct } from "./types";

/**
 * "ยังไม่มีไฟล์ที่ตรงแบบ?" (upload redesign Phase 1 item 3): the product and every one of its real standard sizes, the
 * live template, and the template as PDF — drawn in the browser by the same engine the check reads with, the die on
 * `CutContour` / `Crease` spot layers and the bleed box at the rules' bleed. No `.ai` (no Illustrator writer exists;
 * Illustrator opens the PDF with its layers). Products the engine cannot draw keep the size list and say the team
 * sends the template with the order.
 */
export function TemplateBox({ products, bleedMm }: { products: UploadProduct[]; bleedMm: string | null }) {
  const t = useTranslations("studio.upload.template");
  const format = useFormat();
  const [slug, setSlug] = useState(products[0]?.slug ?? null);
  const [sizeCode, setSizeCode] = useState<string | null>(null);
  const configurator = useConfigurator(slug);
  const cfg = configurator.data ?? null;
  const sizes = cfg?.standardSizes ?? [];
  const size = sizes.find((s) => s.code === sizeCode) ?? sizes[0] ?? null;
  const styleId = cfg ? templateStyleOf(cfg) : null;
  const product = products.find((p) => p.slug === slug) ?? null;
  const drawable = useMemo(() => {
    if (!styleId || !size) return false;
    try {
      getStyle(styleId).build(
        { ...getStyle(styleId).defaults, length: size.lengthMm, width: size.widthMm, height: size.heightMm },
        referenceMaterial(cfg!),
      );
      return true;
    } catch {
      return false;
    }
  }, [styleId, size, cfg]);

  const download = () => {
    if (!styleId || !size || !product || !cfg || bleedMm === null) return;
    const bytes = templatePdf(styleId, size, referenceMaterial(cfg), {
      bleedMm: Number(bleedMm),
      title: `${product.name} ${size.code}`,
    });
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `getpack-template-${product.slug}-${size.code}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    trackUpload("template_download", { product: product.slug, size: size.code, format: "pdf" });
  };

  return (
    <aside
      aria-labelledby="upload-template"
      className="rounded-card border-border bg-surface flex flex-col gap-3.5 border p-5"
    >
      <h3 id="upload-template" className="text-lg leading-snug font-semibold">
        {t("title")}
      </h3>
      <p className="text-muted -mt-1.5 text-sm">{t("body")}</p>
      <label className="text-muted grid gap-1.5 text-[0.8125rem] font-medium">
        {t("product")}
        <NativeSelect
          value={slug ?? undefined}
          onValueChange={(value) => {
            setSlug(value);
            setSizeCode(null);
          }}
          options={products.map((p) => ({
            value: p.slug,
            label: p.startingPrice ? t("productOption", { name: p.name, price: format.thb(p.startingPrice) }) : p.name,
          }))}
        />
      </label>
      <label className="text-muted grid gap-1.5 text-[0.8125rem] font-medium">
        {t("size")}
        {sizes.length ? (
          <NativeSelect
            value={size?.code}
            onValueChange={setSizeCode}
            options={sizes.map((s) => ({
              value: s.code,
              label: t("sizeOption", { code: s.code, l: s.lengthMm, w: s.widthMm, h: s.heightMm }),
            }))}
          />
        ) : (
          <NativeSelect disabled options={[{ value: "-", label: t("sizeFromProduct") }]} value="-" />
        )}
      </label>
      <div className="bg-bg-subtle rounded-control grid h-40 place-items-center overflow-hidden p-2">
        {configurator.isPending ? (
          <Skeleton className="size-full" />
        ) : drawable && styleId && size && cfg ? (
          <BoxPreview
            styleId={styleId}
            values={{ length: size.lengthMm, width: size.widthMm, height: size.heightMm }}
            material={referenceMaterial(cfg)}
            colour="#d8c3a0"
            label={t("previewLabel", { name: product?.name ?? "", code: size.code })}
          />
        ) : (
          <p className="text-muted max-w-[30ch] text-center text-sm">{t("notDrawable")}</p>
        )}
      </div>
      {drawable && bleedMm !== null ? (
        <>
          <Button variant="primary" iconStart="download" onClick={download}>
            {t("downloadPdf")}
          </Button>
          <p className="text-muted m-0 text-xs">{t("hint", { bleed: bleedMm })}</p>
        </>
      ) : null}
    </aside>
  );
}
