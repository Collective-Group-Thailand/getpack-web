import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { listProducts, publicApi } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { HOME_WRAP } from "@/features/customer/home/parts";
import { UploadApp } from "@/features/customer/upload/UploadApp";
import { NextStep } from "@/features/customer/shell/NextStep";
import { UploadSections } from "@/features/customer/upload/UploadSections";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { readAccessToken } from "@/lib/auth/session";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("studio.upload");
  return { title: t("metaTitle") };
}

/**
 * `/studio/upload` — "มีไฟล์แล้ว อัปโหลดเลย" (upload redesign Phase 1 → 2, C9, D-457): upload PDF / AI files, the API
 * reads the die lines and checks them with the 12 checks before ordering, the spec and price come from the same
 * pricing service as /configure, and a file with nothing to fix goes in the cart with it (GLOBAL-RULES §6). Lists only
 * the products with an instant price (own-file products, DECISIONS-STAGE-A §1) plus "สินค้าอื่น ขอใบเสนอราคา".
 */
export default async function StudioUpload({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query, jar] = await Promise.all([params, searchParams, cookies()]);
  // A full-page arrival from /studio's drop zone keeps only the name (a client-side one hands the file over).
  const fileName = typeof query.file === "string" && query.file.length <= 120 ? query.file : null;
  setRequestLocale(locale);
  const signedIn = Boolean(readAccessToken(jar));
  const [t, format, products, rules] = await Promise.all([
    getTranslations("studio.upload"),
    getFormat(),
    listProducts({ perPage: 48 }).catch(() => null),
    publicApi("content")
      .then(async (api) => (await api.GET("/v1/store/file-checks/rules")).data ?? null)
      .catch(() => null),
  ]);
  const ownFile = (products?.data ?? [])
    .filter((product) => product.availability !== "rfq")
    .map((product) => ({
      slug: product.slug,
      name: pick(locale, product.nameTh, product.nameEn),
      startingPrice: product.startingPricePerPiece ?? null,
      moq: product.moq ?? null,
    }));

  return (
    <div className={cn(HOME_WRAP, "pt-6 pb-16 md:pt-8 md:pb-20")}>
      <nav aria-label={t("crumbsLabel")} className="text-muted mb-3 flex gap-2 text-[0.8125rem]">
        <Link href="/studio" className="hover:text-fg">
          {t("crumbStudio")}
        </Link>
        <Icon name="chevron-right" size={14} aria-hidden="true" className="self-center" />
        <span aria-current="page">{t("crumbUpload")}</span>
      </nav>
      <h1 className="text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance md:text-[2.25rem]">
        {t("title")}
      </h1>
      <p className="text-muted mt-2.5 max-w-[60ch] text-[1.03125rem] text-pretty">{t("lead")}</p>
      <p className="text-muted mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[0.84375rem]">
        {(
          [
            ["scan", "proofAuto"],
            ["users", "proofTeam"],
            ["lock", "proofPrivate"],
          ] as const
        ).map(([icon, key]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <Icon name={icon} size={17} className="text-primary" aria-hidden="true" />
            {t(key)}
          </span>
        ))}
      </p>

      {ownFile.length ? (
        <UploadApp products={ownFile} signedIn={signedIn} handedFileName={fileName} />
      ) : (
        // No product takes an own file yet: a calm card with the way on, not a bare line between rules.
        <EmptyState
          className="mt-6"
          icon="upload"
          title={t("none")}
          action={<NextStep to="chat" />}
          secondary={<NextStep to="products" variant="ghost" />}
        />
      )}
      <p className="text-muted mt-4 text-[0.8125rem]">
        {t.rich("others", {
          link: (chunks) => (
            <Link href="/products" className="text-fg border-b border-current pb-px font-medium">
              {chunks}
            </Link>
          ),
        })}
      </p>

      <UploadSections rules={rules} maxLabel={rules ? format.bytes(rules.maxBytes) : null} />
    </div>
  );
}
