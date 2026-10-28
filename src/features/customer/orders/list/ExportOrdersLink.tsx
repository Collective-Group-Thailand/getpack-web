"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { trackAccount } from "@/lib/analytics/account";
import { Button } from "@/ui/components/Button";

/**
 * "ส่งออก" (account pack Phase 2 item 1): the orders of this tab and search as a CSV file that Excel opens in Thai
 * (`/account/orders/export`, built on the server from the API's list). Reports `orders_export`.
 */
export function ExportOrdersLink({ tab, q }: { tab: string; q: string }) {
  const t = useTranslations("myOrders.list");
  const params = new URLSearchParams({ tab });
  if (q) params.set("q", q);
  return (
    <Button asChild variant="secondary" iconStart="download">
      <Link
        href={`/account/orders/export?${params.toString()}`}
        download
        prefetch={false}
        onClick={() => trackAccount("orders_export", { tab, format: "csv" })}
      >
        {t("export")}
      </Link>
    </Button>
  );
}
