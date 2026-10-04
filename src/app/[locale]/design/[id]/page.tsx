import { notFound } from "next/navigation";

import { getDesignerCatalog } from "@/features/customer/catalog/api.server";
import { CustomerDesigner } from "@/features/customer/designer/CustomerDesigner";
import { getMyDesign } from "@/features/customer/designer/api.server";
import { seedOf, text, uuid, type Query } from "@/features/customer/designer/seed";
import { documentOf } from "@/features/designer/data/published";
import { getActor } from "@/lib/auth/actor";

export const metadata = { title: "ออกแบบกล่อง" };

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
