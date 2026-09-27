"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";

import type { DesignerCatalog } from "@/features/designer/data/api";
import Editor, { type EditorSeed, type EditorSession, type InitialDesign } from "@/features/designer/components/Editor";
import { designRepo } from "@/features/designer/storage";
import { useRouter } from "@/i18n/navigation";
import { useEditor } from "@/features/designer/store/editor";

import { OrderAction, type OrderLink } from "./OrderAction";
import { PriceWidget } from "./PriceWidget";

export interface CustomerDesignerProps {
  id: string;
  signedIn: boolean;
  /** The account's copy, when the page read one. */
  design: (InitialDesign & { link: OrderLink | null; productSlug: string | null }) | null;
  catalog: DesignerCatalog | null;
  seed?: EditorSeed;
  /** The order line a new design is for (from the order's "design online"). */
  link: OrderLink | null;
  templateId?: string | null;
}

/**
 * The designer as the storefront opens it. A signed-in customer's design lives in the account
 * (autosaved, versioned); a guest's stays in this browser until sign-in imports it. The top bar
 * carries the live price for the design's product and the one next step — send to print for a
 * design that belongs to an order, order it otherwise.
 */
export function CustomerDesigner({ id, signedIn, design, catalog, seed, link, templateId }: CustomerDesignerProps) {
  // A design id the account does not know but this browser does: a guest design from before
  // sign-in, opened from the list before it is imported. It still opens, from the browser.
  const [localFallback] = useState(
    () => signedIn && !design && id !== "new" && typeof window !== "undefined" && !!designRepo.get(id),
  );
  const mode = signedIn && !localFallback ? "store" : "local";
  const productSlug = design?.productSlug ?? seed?.productSlug ?? catalog?.product?.slug ?? null;
  const orderLink = design?.link ?? link;
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (catalog?.rules.bleedMm) useEditor.getState().setBleed(catalog.rules.bleedMm);
  }, [catalog]);

  const session: EditorSession = {
    mode,
    editable: true,
    design,
    create: {
      source: link ? "order_item" : templateId ? "template" : productSlug ? "product" : "blank",
      ...(productSlug ? { catalogProductSlug: productSlug } : {}),
      ...(seed?.patternId ? { patternId: seed.patternId } : {}),
      ...(seed?.materialId ? { materialId: seed.materialId } : {}),
      ...(link ? { link: { orderId: link.orderId, itemId: link.itemId } } : {}),
      ...(templateId ? { templateId } : {}),
    },
  };

  return (
    <Editor
      id={id}
      nav={{
        home: locale === "en" ? "/en" : "/",
        push: (href) => router.push(href),
        replace: (href) => router.replace(href),
      }}
      session={session}
      catalog={catalog}
      seed={seed}
      topBarExtra={productSlug && mode === "store" ? <PriceWidget productSlug={productSlug} /> : null}
      primaryAction={<OrderAction link={mode === "store" ? orderLink : null} productSlug={productSlug} />}
    />
  );
}
