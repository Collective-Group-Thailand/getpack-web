"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { DesignerCatalog } from "@/features/designer/data/api";
import Editor, { type EditorSeed, type EditorSession, type InitialDesign } from "@/features/designer/components/Editor";
import { designRepo } from "@/features/designer/storage";
import { useRouter } from "@/i18n/navigation";
import { useEditor } from "@/features/designer/store/editor";
import { track } from "@/lib/analytics/track";

import { OrderAction, type OrderLink } from "./OrderAction";
import { PriceWidget } from "./PriceWidget";

const DESIGN_ROUTE = "/design/[id]";

export interface CustomerDesignerProps {
  id: string;
  signedIn: boolean;
  /** The account's copy, when the page read one. */
  design: InitialDesign | null;
  catalog: DesignerCatalog | null;
  seed?: EditorSeed;
  /** The order line the design is for, as the page was opened (`?order=&item=&orderCode=`). */
  link: OrderLink | null;
  /** The product the design is for, as the page was opened (`?product=`). */
  productSlug: string | null;
  /** That product's id, which a new account design needs (`DesignerCatalogDto.product.id`). */
  catalogProductId: string | null;
  templateId?: string | null;
}

/**
 * The designer as the storefront opens it. A signed-in customer's design lives in the account
 * (autosaved, versioned); a guest's stays in this browser until sign-in imports it. The top bar
 * carries the live price for the design's product and the one next step — send to print for a
 * design that belongs to an order, order it otherwise.
 *
 * A saved design names its product, and the product's designer catalogue its id. The order line
 * the page was opened with is carried in the address when `/design/new` becomes the design's own.
 *
 * CONTRACT-GAP store.catalog-product-ref — a design opened without a product (a blank one) has no
 * product id: it cannot be made in the account and stays in this browser.
 */
export function CustomerDesigner({
  id,
  signedIn,
  design,
  catalog,
  seed,
  link,
  productSlug: openedWith,
  catalogProductId,
  templateId,
}: CustomerDesignerProps) {
  const t = useTranslations("designer.account");
  // A design id the account does not know but this browser does: a guest design from before
  // sign-in, opened from the list before it is imported. It still opens, from the browser.
  const [localFallback] = useState(
    () => signedIn && !design && id !== "new" && typeof window !== "undefined" && !!designRepo.get(id),
  );
  const cannotCreate = !design && id === "new" && !catalogProductId;
  const mode = signedIn && !localFallback && !cannotCreate ? "store" : "local";
  const productSlug = openedWith ?? seed?.productSlug ?? catalog?.product?.slug ?? null;
  const orderLink = link;
  const carried = new URLSearchParams({
    ...(productSlug ? { product: productSlug } : {}),
    ...(link ? { order: link.orderId, item: link.itemId, orderCode: link.orderCode } : {}),
  }).toString();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (catalog?.rules.bleedMm) useEditor.getState().setBleed(catalog.rules.bleedMm);
  }, [catalog]);

  // The studio funnel (docs/ux/funnels.md): a new design opened, then its first confirmed save.
  useEffect(() => {
    if (id === "new") track("design_started", { route: DESIGN_ROUTE });
  }, [id]);
  const savedOnce = useRef(false);
  const onSaved = () => {
    if (savedOnce.current) return;
    savedOnce.current = true;
    track("design_saved", { route: DESIGN_ROUTE });
  };

  const session: EditorSession = {
    mode,
    // A guest's design keeps its product in the browser too, so sign-in can import it.
    editable: true,
    design,
    create: catalogProductId
      ? {
          catalogProductId,
          ...(seed?.patternId ? { patternId: seed.patternId } : {}),
          ...(seed?.materialId ? { materialId: seed.materialId } : {}),
          ...(templateId ? { semiDesignTemplateId: templateId } : {}),
        }
      : undefined,
    onSaved,
  };

  return (
    <Editor
      id={id}
      nav={{
        home: locale === "en" ? "/en" : "/",
        push: (href) => router.push(href),
        replace: (href) => router.replace(carried && href.startsWith("/design/") ? `${href}?${carried}` : href),
      }}
      session={session}
      catalog={catalog}
      seed={seed}
      topBarExtra={
        productSlug && mode === "store" ? (
          <PriceWidget productSlug={productSlug} />
        ) : signedIn && cannotCreate ? (
          <span className="text-muted text-xs">{t("browserOnly")}</span>
        ) : null
      }
      primaryAction={<OrderAction link={mode === "store" ? orderLink : null} productSlug={productSlug} />}
    />
  );
}
