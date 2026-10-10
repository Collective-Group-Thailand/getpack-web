"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { useRefresh } from "@/features/partner/client";
import { Button } from "@/ui/components/Button";

const EVERY = 30_000;

/** Keeps a kiosk screen current: refreshes every 30 seconds while the tab is visible, and on demand. */
export function KioskRefresh() {
  const t = useTranslations("partnerOps.kiosk");
  const [refresh, pending] = useRefresh();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, EVERY);
    return () => window.clearInterval(timer);
  }, [refresh]);
  return (
    <Button variant="secondary" size="xl" iconStart="refresh" loading={pending} onClick={refresh}>
      {t("refresh")}
    </Button>
  );
}
