"use client";

import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { trackProducts } from "@/lib/analytics/products";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

import { trayStore, useTray } from "./rfq-store";
import { trayItemHref } from "./tray-flow";

/**
 * The floating "ใบขอราคา" bar (prompt item 8, prototype `.tray`): how many items, "ส่งคำขอราคา" and
 * "ล้าง". Sending walks the existing quotation flow item by item — each item's RFQ form in tray mode,
 * added to the account's draft basket — and ends on the basket, where everything is sent at once
 * (D-301). Shown only while the tray holds something; the LINE button moves above it.
 */
export function RfqTray() {
  const t = useTranslations("products.rfq");
  const router = useRouter();
  const tray = useTray();
  if (tray.length === 0) return null;
  return (
    <div
      data-rfq-tray=""
      role="region"
      aria-label={t("tray")}
      className="z-sticky fixed inset-x-3 bottom-[calc(var(--mobile-tab-h)+0.75rem)] flex justify-center md:bottom-5"
    >
      <div className="bg-fg text-bg shadow-overlay rounded-card flex max-w-full items-center gap-3 py-2 ps-4 pe-2 md:gap-3.5">
        <p className="text-[0.8125rem] whitespace-nowrap tabular-nums md:text-sm" aria-live="polite">
          {t.rich("count", { count: tray.length, b: (chunks) => <b className="font-semibold">{chunks}</b> })}
        </p>
        <Button
          type="button"
          size="md"
          className="bg-bg text-fg hover:bg-bg/90"
          onClick={() => {
            trackProducts("products_rfq_submit", { count: tray.length });
            router.push(trayItemHref(tray[0]!));
          }}
        >
          {t("send")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-bg/80 hover:text-bg"
          onClick={() => {
            trayStore.clear();
            toast(t("cleared"));
          }}
        >
          {t("clear")}
        </Button>
      </div>
    </div>
  );
}
