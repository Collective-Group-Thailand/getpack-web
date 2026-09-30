"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * The public tracking page for an order, to share (F3 3.6). The link is made when asked for
 * (`store.timeline.createTrackingLink`, one key per intent) — never while the page renders, since
 * making one is a write.
 */
export function TrackingLinkButton({ orderId }: { orderId: string }) {
  const t = useTranslations("myOrders.detail");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  return (
    <Button
      size="sm"
      variant="link"
      className="px-0"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { data } = await browserApi().POST("/v1/store/orders/{orderId}/tracking-links", {
            params: { path: { orderId }, header: { "Idempotency-Key": key.current } },
          });
          router.push(`/track/${encodeURIComponent(data!.token)}`);
        } catch (error) {
          key.current = newKey();
          toast.error(isApiError(error) ? error.detail : t("trackingFailed"));
          setBusy(false);
        }
      }}
    >
      {t("publicTracking")}
    </Button>
  );
}
