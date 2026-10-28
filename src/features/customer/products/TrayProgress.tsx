"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { toast } from "@/ui/components/Toast";

import { nextTrayHref, useQuoteTray } from "./quote-tray";
import { trayId, type TrayItem } from "./rfq-store";
import { TRAY_DONE_HREF, trayItemHref } from "./tray-flow";

/**
 * "ใบขอราคา: รายการที่ 2 จาก 4" over the RFQ form while the hub's tray walks its items (prompt item 8),
 * with "ข้ามรายการนี้" — which takes the item out of the tray (signed in: its waiting basket line, D-447 §10.9)
 * and opens the next one (or the basket).
 */
export function TrayProgress({ current, className }: { current: Pick<TrayItem, "kind" | "key">; className?: string }) {
  const t = useTranslations("products.rfq");
  const router = useRouter();
  const tray = useQuoteTray();
  const [busy, setBusy] = useState(false);
  const index = tray.items.findIndex((item) => trayId(item) === trayId(current));
  if (index < 0) return null;
  return (
    <Callout
      className={className}
      icon="clipboard-check"
      title={t("progress", { index: index + 1, total: tray.items.length })}
    >
      <p>{t("progressBody")}</p>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="-ms-3 mt-2"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await tray.remove(current);
            router.push(await nextTrayHref(current, tray.mode.account, trayItemHref, TRAY_DONE_HREF));
          } catch {
            toast.error(t("failed"));
            setBusy(false);
          }
        }}
      >
        {t("skip")}
      </Button>
    </Callout>
  );
}
