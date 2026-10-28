"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { trackProducts } from "@/lib/analytics/products";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

import { useQuoteTray } from "./quote-tray";
import { TRAY_MAX, type TrayItem } from "./rfq-store";

/**
 * "เพิ่มในใบขอราคา" / "อยู่ในใบขอราคา" on a card or a table row (prompt items 6–8): one press puts the
 * product in the tray or takes it out, with a toast either way. A toggle button (`aria-pressed`), so a
 * screen reader hears its state. Signed in, the tray is the draft RFQ basket (D-447 / §10.9).
 */
export function RfqToggle({ item, name, size = "md" }: { item: TrayItem; name: string; size?: "sm" | "md" }) {
  const t = useTranslations("products");
  const tray = useQuoteTray();
  const [busy, setBusy] = useState(false);
  const inTray = tray.has(item);
  return (
    <Button
      type="button"
      variant="soft"
      size={size}
      aria-pressed={inTray}
      aria-label={t(inTray ? "card.rfqRemoveLabel" : "card.rfqAddLabel", { name })}
      iconStart={inTray ? "check" : "plus"}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          if (inTray) {
            await tray.remove(item);
            trackProducts("products_rfq_remove", { product: item.key, count: Math.max(0, tray.items.length - 1) });
            toast(t("rfq.removed"));
            return;
          }
          const result = await tray.add(item);
          if (result !== "added") {
            toast.error(result === "full" ? t("rfq.full", { max: TRAY_MAX }) : t("rfq.failed"));
            return;
          }
          trackProducts("products_rfq_add", { product: item.key, count: tray.items.length + 1 });
          toast.success(t("rfq.added"));
        } catch {
          toast.error(t("rfq.failed"));
        } finally {
          setBusy(false);
        }
      }}
    >
      {t(inTray ? "card.rfqIn" : "card.rfqAdd")}
    </Button>
  );
}
