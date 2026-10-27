"use client";

import { useTranslations } from "next-intl";

import { trackProducts } from "@/lib/analytics/products";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

import { TRAY_MAX, trayStore, useTray, type TrayItem } from "./rfq-store";

/**
 * "เพิ่มในใบขอราคา" / "อยู่ในใบขอราคา" on a card or a table row (prompt items 6–8): one press puts the
 * product in the tray or takes it out, with a toast either way. A toggle button (`aria-pressed`), so a
 * screen reader hears its state.
 */
export function RfqToggle({ item, name, size = "md" }: { item: TrayItem; name: string; size?: "sm" | "md" }) {
  const t = useTranslations("products");
  const tray = useTray();
  const inTray = tray.some((entry) => entry.kind === item.kind && entry.key === item.key);
  return (
    <Button
      type="button"
      variant="soft"
      size={size}
      aria-pressed={inTray}
      aria-label={t(inTray ? "card.rfqRemoveLabel" : "card.rfqAddLabel", { name })}
      iconStart={inTray ? "check" : "plus"}
      onClick={() => {
        if (inTray) {
          trayStore.remove(item);
          trackProducts("products_rfq_remove", { product: item.key, count: trayStore.items().length });
          toast(t("rfq.removed"));
          return;
        }
        if (!trayStore.add(item)) {
          toast.error(t("rfq.full", { max: TRAY_MAX }));
          return;
        }
        trackProducts("products_rfq_add", { product: item.key, count: trayStore.items().length });
        toast.success(t("rfq.added"));
      }}
    >
      {t(inTray ? "card.rfqIn" : "card.rfqAdd")}
    </Button>
  );
}
