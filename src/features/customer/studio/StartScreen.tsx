"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { STYLES } from "@packio/dieline";
import { DesignThumb } from "@/features/customer/account/DesignThumb";
import type { DesignerCatalog } from "@/features/designer/data/api";
import type { DesignSpec } from "@/features/designer/types";
import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { Dialog } from "@/ui/components/Dialog";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { DescribeProduct } from "./DescribeProduct";
import { studioHref } from "./paths";

type Intent = "box" | "product" | "file" | "reorder";

/** Each intent's icon on its tinted tile (the "StudioStart" board). */
const TILE: Record<Intent, { icon: IconName; className: string }> = {
  box: { icon: "box", className: "bg-primary-subtle text-primary" },
  product: { icon: "ruler", className: "bg-warning-subtle text-warning-subtle-fg" },
  file: { icon: "upload", className: "bg-surface-subtle text-fg" },
  reorder: { icon: "refresh", className: "bg-sage-subtle text-fg" },
};

/** How many recent designs the start page lists before "see all". */
const RECENT = 2;

/**
 * The studio's first page, to the "StudioStart" board: the step, the serif question, four intent
 * cards — choose a box and design it (the popular one); you have the product (describe it here and
 * get boxes that fit); you have a finished file (the configurator); reorder — then the customer's
 * two latest designs and a sample box to play with. It is the whole page until a box is chosen.
 */
export function StartScreen({
  onChooseBox,
  onPickSpec,
  catalog,
  productSlug,
  productName,
  signedIn,
}: {
  onChooseBox: () => void;
  /** A box suggested from the product's size: sets it and moves on. */
  onPickSpec: (spec: DesignSpec) => void;
  catalog: DesignerCatalog | null;
  productSlug: string | null;
  productName: string | null;
  signedIn: boolean;
}) {
  const t = useTranslations("studio.startScreen");
  const format = useFormat();
  // `/studio/new?start=product` (the studio's front door, "มีสินค้าแล้ว") opens on describing it.
  const search = useSearchParams();
  const [describing, setDescribing] = useState(search.get("start") === "product");
  const configure = productSlug ? `/configure/${productSlug}` : "/products";
  const recent = useQuery({
    queryKey: ["studio", "start", "recent"],
    enabled: signedIn,
    queryFn: async () => {
      const { data } = await browserApi().GET("/v1/store/designs", {
        params: { query: { perPage: RECENT, sort: "updatedAt", order: "desc" } },
      });
      return data!;
    },
  });

  const card = (popular = false) =>
    cn(
      "group bg-surface relative flex h-full flex-col rounded-card border p-6 text-start outline-none",
      "duration-fast transition-[box-shadow,translate] hover:shadow-lift motion-safe:hover:-translate-y-0.5",
      "focus-visible:ring-focus-ring focus-visible:ring-2",
      popular ? "border-primary border-[1.5px]" : "border-border",
    );
  const body = (intent: Intent, popular = false) => (
    <>
      {popular ? (
        <span className="bg-primary-subtle text-primary-subtle-fg rounded-control absolute end-4 top-4 px-2 py-0.5 text-[11px] font-semibold">
          {t("popular")}
        </span>
      ) : null}
      <span className={cn("rounded-control grid size-13 place-items-center", TILE[intent].className)}>
        <Icon name={TILE[intent].icon} size={24} aria-hidden="true" />
      </span>
      <span className="mt-5 text-lg leading-snug font-semibold">{t(`${intent}.title`)}</span>
      <span className="text-muted mt-2 text-sm leading-relaxed">
        {intent === "box" ? t("box.body", { count: STYLES.length }) : t(`${intent}.body`)}
      </span>
      <span className="text-primary mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold">
        {t(`${intent}.go`)}
        <Icon
          name="arrow-right"
          size={15}
          aria-hidden="true"
          className="duration-fast transition-transform motion-safe:group-hover:translate-x-1"
        />
      </span>
    </>
  );

  const designs = recent.data?.data ?? [];
  const total = recent.data?.meta.total ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-[1116px] flex-col px-5 py-10 md:px-8 md:py-14">
      <div className="text-center">
        <h1 className="text-4xl leading-tight md:text-[3.25rem]">{t("title")}</h1>
        <p className="text-muted mx-auto mt-3 max-w-[40em]">{signedIn ? t("lead") : t("leadGuest")}</p>
        {productName ? <p className="mt-2 text-sm font-medium">{t("forProduct", { name: productName })}</p> : null}
      </div>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <li>
          <button type="button" onClick={onChooseBox} className={card(true)}>
            {body("box", true)}
          </button>
        </li>
        <li>
          <button type="button" onClick={() => setDescribing(true)} className={card()}>
            {body("product")}
          </button>
        </li>
        <li>
          <Link href={configure} className={card()}>
            {body("file")}
          </Link>
        </li>
        <li>
          <Link href={signedIn ? "/account/orders" : "/sign-in?returnTo=%2Faccount%2Forders"} className={card()}>
            {body("reorder")}
          </Link>
        </li>
      </ul>

      <section aria-labelledby="studio-recent" className="mt-12">
        {signedIn && designs.length > 0 ? (
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 id="studio-recent" className="text-lg font-semibold">
              {t("recentTitle")}
            </h2>
            {total > designs.length ? (
              <Link href="/account/designs" className="text-primary text-sm font-semibold hover:underline">
                {t("recentAll", { count: total })}
              </Link>
            ) : null}
          </div>
        ) : (
          <h2 id="studio-recent" className="sr-only">
            {t("sample")}
          </h2>
        )}
        <ul className="grid gap-4 md:grid-cols-3">
          {signedIn
            ? designs.map((design) => (
                <li key={design.id}>
                  <Link
                    href={`/studio/${design.id}`}
                    className="border-border bg-surface hover:shadow-lift focus-visible:ring-focus-ring rounded-card flex items-center gap-4 border p-3.5 outline-none focus-visible:ring-2"
                  >
                    <span className="bg-sage-subtle rounded-thumb size-16 shrink-0 overflow-hidden">
                      <DesignThumb fileId={design.thumbnailFileId} empty="" />
                    </span>
                    <span className="min-w-0">
                      <b className="block truncate text-[15px]">{design.title}</b>
                      <small className="text-muted block truncate text-xs">
                        {design.orders[0]
                          ? t("recentOrdered", { code: design.orders[0].orderCode })
                          : t("recentEdited", { when: format.relative(design.updatedAt) })}
                      </small>
                    </span>
                  </Link>
                </li>
              ))
            : null}
          <li className={cn(designs.length === 0 && "md:col-start-2")}>
            <Link
              href={studioHref({
                ...(productSlug ? { product: productSlug } : {}),
                style: "tuck-end",
                dims: { l: 70, w: 40, h: 150 },
                step: "design",
              })}
              className="bg-surface border-border text-muted hover:text-fg hover:border-primary focus-visible:ring-focus-ring rounded-card flex h-full min-h-[5.75rem] items-center justify-center gap-2 border border-dashed px-4 text-center text-sm font-medium outline-none focus-visible:ring-2"
            >
              <Icon name="sparkles" size={16} aria-hidden="true" />
              {t("sample")}
            </Link>
          </li>
        </ul>
      </section>

      <Dialog open={describing} onOpenChange={setDescribing} title={t("describeTitle")} closeLabel={t("close")}>
        <DescribeProduct
          catalog={catalog}
          onPick={(spec) => {
            setDescribing(false);
            onPickSpec(spec);
          }}
        />
      </Dialog>
    </div>
  );
}
