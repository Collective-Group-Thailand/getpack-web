import { notFound } from "next/navigation";
import { resolveStyleId } from "@packio/dieline";

import { getDesignerCatalog } from "@/features/customer/catalog/api.server";
import { CustomerDesigner } from "@/features/customer/designer/CustomerDesigner";
import { getMyDesign } from "@/features/customer/designer/api.server";
import { documentOf } from "@/features/designer/data/published";
import type { EditorSeed } from "@/features/designer/components/Editor";
import { getActor } from "@/lib/auth/actor";

export const metadata = { title: "ออกแบบกล่อง" };

type Query = Record<string, string | string[] | undefined>;
const text = (value: unknown) => (typeof value === "string" && value.length > 0 && value.length < 120 ? value : null);
const uuid = (value: unknown) =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
const mm = (value: unknown) => (typeof value === "string" && /^\d{1,4}(\.\d)?$/.test(value) ? Number(value) : null);

/**
 * A new design's starting point (F4 C.2): `?style=&l=&w=&h=` from the configurator or an order's
 * artwork page, plus `product`, `pattern` and `material` to preselect the catalogue's choices.
 * Anything malformed is ignored — the setup dialog still opens. A saved design names its product
 * (`DesignDocumentDto.product`); the order line it is being made for (`order`, `item`, `orderCode`)
 * stays in the address once the design has its own id, since a design names only the orders it was
 * used in (`orders`), not the line waiting for it.
 */
function seedOf(query: Query): EditorSeed | undefined {
  const style = typeof query.style === "string" ? resolveStyleId(query.style) : null;
  const [length, width, height] = [mm(query.l), mm(query.w), mm(query.h)];
  if (!style || !length || !width || !height) return undefined;
  return {
    style,
    dims: { length, width, height },
    productSlug: text(query.product),
    patternId: uuid(query.pattern),
    materialId: uuid(query.material),
  };
}

export default async function DesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Query>;
}) {
  const [{ id }, query, actor] = await Promise.all([params, searchParams, getActor("customer")]);
  const signedIn = actor !== null;

  const saved = signedIn && id !== "new" ? await getMyDesign(id) : null;
  // An account design id that is not the customer's is not found; a guest's browser id is not an
  // account id at all, so a signed-in customer opening one falls back to the browser copy.
  if (signedIn && id !== "new" && !saved && uuid(id)) notFound();

  // The product the page was opened with, else the one the saved design names.
  const productSlug = text(query.product) ?? (saved?.data.product.slug || undefined);
  // The designer catalogue of the product names its id, which a new account design is created under.
  const catalog = await getDesignerCatalog(productSlug);
  const document = saved ? documentOf(saved.data) : null;
  const orderId = uuid(query.order);
  const itemId = uuid(query.item) ?? orderId;
  const orderCode = text(query.orderCode);

  return (
    <CustomerDesigner
      id={saved?.data.id ?? id}
      signedIn={signedIn}
      catalog={catalog}
      seed={id === "new" ? seedOf(query) : undefined}
      templateId={id === "new" ? uuid(query.template) : null}
      link={orderId && itemId && signedIn ? { orderId, itemId, orderCode: orderCode ?? "" } : null}
      productSlug={productSlug ?? null}
      catalogProductId={saved?.data.catalogProductId ?? catalog?.product.id ?? null}
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
            }
          : null
      }
    />
  );
}
