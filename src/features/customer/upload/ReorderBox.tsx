"use client";

import { useLocale, useTranslations } from "next-intl";

import { pick } from "@/features/customer/catalog/localize";
import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { trackUpload } from "@/lib/analytics";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";

import { useReorderable } from "./api";

/**
 * "สั่งซ้ำจากไฟล์เดิม" (upload redesign Phase 1 item 4): signed in, with own-file orders already produced — the produced
 * file, product, last order date and quantity; "ดู" opens the order, "สั่งซ้ำ" the existing reorder (D-153: the
 * approved file, no re-check, today's price). Hidden when there is none.
 */
export function ReorderBox({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("studio.upload.reorder");
  const locale = useLocale();
  const format = useFormat();
  const rows = useReorderable(signedIn);
  if (!signedIn || !rows.data?.length) return null;
  return (
    <section aria-labelledby="upload-reorder" className="rounded-card border-border bg-surface mt-5 border px-5 py-4">
      <h3 id="upload-reorder" className="text-[1.0625rem] font-semibold">
        {t("title")}
      </h3>
      <p className="text-muted mt-1 mb-2.5 text-sm">{t("body")}</p>
      <ul>
        {rows.data.map((row) => (
          <li
            key={row.orderId}
            className="border-border grid grid-cols-[3.5rem_1fr] items-center gap-3.5 border-t py-3 sm:grid-cols-[3.5rem_1fr_auto_auto]"
          >
            <span className="bg-bg-subtle rounded-control grid h-11 w-14 place-items-center overflow-hidden">
              {row.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed URL of the customer's own thumbnail
                <img src={row.thumbnailUrl} alt="" className="size-full object-cover" />
              ) : (
                <Icon name="document" size={20} aria-hidden="true" className="text-muted" />
              )}
            </span>
            <span className="min-w-0">
              <b className="block truncate text-sm font-semibold">{row.fileName ?? row.orderCode}</b>
              <small className="text-muted block text-[0.78125rem] tabular-nums">
                {t("meta", {
                  product: pick(locale, row.productNameTh ?? "", row.productNameEn ?? ""),
                  date: format.date(row.orderedAt),
                  qty: format.number(row.quantity),
                })}
              </small>
            </span>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/account/orders/${row.orderId}`}>{t("view")}</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/account/orders/${row.orderId}/reorder`} onClick={() => trackUpload("reorder_click", {})}>
                {t("reorder")}
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
