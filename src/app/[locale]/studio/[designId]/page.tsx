import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getStyle, isStyleId } from "@getpack/dieline";

import { defaultProductForStyle, getDesignerCatalog } from "@/features/customer/catalog/api.server";
import { getMyDesign } from "@/features/customer/designer/api.server";
import { seedOf, text, uuid, type Query } from "@/features/customer/designer/seed";
import { Studio } from "@/features/customer/studio/Studio";
import { boxFieldsOf, documentOf } from "@/features/designer/data/published";
import { getActor } from "@/lib/auth/actor";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("studio.meta");
  return { title: t("title"), robots: { index: false } };
}

/**
 * getpack 3D Studio (U4.1): `/studio/new?product=&style=&l=&w=&h=` starts a design from a product, a
 * style page or the configurator; `/studio/<id>` opens one of the customer's designs. `?step=` picks
 * the step (start, box, design, check, order). A guest's design stays in the browser; an account
 * design id that is not the customer's is not found.
 */
export default async function StudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ designId: string }>;
  searchParams: Promise<Query>;
}) {
  const [{ designId: id }, query, actor] = await Promise.all([params, searchParams, getActor("customer")]);
  const signedIn = actor !== null;

  const saved = signedIn && id !== "new" ? await getMyDesign(id) : null;
  if (signedIn && id !== "new" && !saved && uuid(id)) notFound();

  // A library style or a published variant (D-407) is read against the whole library, loaded here only then.
  const library =
    id === "new" && typeof query.style === "string" && (query.sv || !isStyleId(query.style))
      ? await import("@getpack/dieline/library")
      : null;
  library?.registerLibrary();
  const seed = id === "new" ? seedOf(query, library?.ALL_RECIPES) : undefined;
  // A box style with no product (the header, the sample): the style's own product type prices it.
  const productSlug =
    text(query.product) ??
    (saved?.data.product.slug || undefined) ??
    (seed && !saved ? ((await defaultProductForStyle(getStyle(seed.style).category)) ?? undefined) : undefined);
  const catalog = await getDesignerCatalog(productSlug);
  const document = saved ? documentOf(saved.data) : null;
  const orderId = uuid(query.order);
  const itemId = uuid(query.item) ?? orderId;
  const orderCode = text(query.orderCode);

  // A new design's seed is its identity: another `?style=&l=&w=&h=` (the sample link, a style
  // page) on the same route mounts a fresh studio instead of keeping the old one's state (round 2, B6).
  const seedKey =
    id === "new"
      ? ["style", "l", "w", "h", "sv", "rv", "product", "template"].map((k) => text(query[k]) ?? "").join(":")
      : id;

  return (
    <Studio
      key={seedKey}
      id={saved?.data.id ?? id}
      signedIn={signedIn}
      catalog={catalog}
      seed={seed ? { ...seed, productSlug: seed.productSlug ?? productSlug ?? null } : undefined}
      templateId={id === "new" ? uuid(query.template) : null}
      link={orderId && itemId && signedIn ? { orderId, itemId, orderCode: orderCode ?? "" } : null}
      productSlug={productSlug ?? null}
      catalogProductId={saved?.data.catalogProductId ?? catalog?.product.id ?? null}
      step={text(query.step) ?? undefined}
      lock={saved?.data.lock ?? null}
      design={
        saved
          ? {
              id: saved.data.id,
              name: saved.data.title,
              document: document ?? { spec: null, content: null },
              versionNo: saved.data.versionNo ?? 0,
              etag: saved.etag,
              updatedAt: saved.data.updatedAt,
              assets: saved.assets,
              box: boxFieldsOf(saved.data),
            }
          : null
      }
    />
  );
}
