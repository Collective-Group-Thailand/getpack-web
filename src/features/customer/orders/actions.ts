/**
 * Where each customer order action goes. The API decides *which* actions an order offers
 * (`nextActions`); this only maps a key to its page. An unknown key still renders — on the order
 * page — rather than disappearing (`src/domain/status/next-action.ts`).
 */
export type Surface = "account" | "liff";

/** Inside LINE (D-151) the proof and reorder have LIFF screens; everything else opens the site. */
export function actionHref(orderId: string, key: string, surface: Surface = "account"): string | null {
  if (surface === "liff") {
    if (key === "order.approve_proof") return `/liff/orders/${orderId}/proof`;
    if (key === "order.reorder") return `/liff/orders/${orderId}/reorder`;
  }
  switch (key) {
    case "order.upload_artwork":
      return `/account/orders/${orderId}/artwork`;
    case "order.approve_proof":
      return `/account/orders/${orderId}/proof`;
    case "order.confirm_receipt":
      return `/account/orders/${orderId}/receipt`;
    case "order.open_claim":
      return `/account/orders/${orderId}/claim`;
    case "order.reorder":
      return `/account/orders/${orderId}/reorder`;
    default:
      return `/account/orders/${orderId}`;
  }
}
