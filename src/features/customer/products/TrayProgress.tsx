"use client";

import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";

import { trayStore, useTray, type TrayItem } from "./rfq-store";
import { TRAY_DONE_HREF, trayItemHref } from "./tray-flow";

/**
 * "ใบขอราคา: รายการที่ 2 จาก 4" over the RFQ form while the hub's tray walks its items (prompt item 8),
 * with "ข้ามรายการนี้" — which takes the item out of the tray and opens the next one (or the basket).
 */
export function TrayProgress({ current, className }: { current: Pick<TrayItem, "kind" | "key">; className?: string }) {
  const t = useTranslations("products.rfq");
  const router = useRouter();
  const tray = useTray();
  const index = tray.findIndex((item) => item.kind === current.kind && item.key === current.key);
  if (index < 0) return null;
  return (
    <Callout
      className={className}
      icon="clipboard-check"
      title={t("progress", { index: index + 1, total: tray.length })}
    >
      <p>{t("progressBody")}</p>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="-ms-3 mt-2"
        onClick={() => {
          trayStore.remove(current);
          const next = trayStore.items()[0];
          router.push(next ? trayItemHref(next) : TRAY_DONE_HREF);
        }}
      >
        {t("skip")}
      </Button>
    </Callout>
  );
}
