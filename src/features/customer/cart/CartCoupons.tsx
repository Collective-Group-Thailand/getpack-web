"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { queryKeys } from "@/lib/api/query-keys";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Sheet } from "@/ui/components/Sheet";
import { Icon } from "@/ui/icons";

import { CouponPicker } from "./CouponPicker";
import { PromoCodeBox, type PromoCodeBoxProps } from "./PromoCodeBox";

/**
 * The order summary's codes (loyalty P1.5, STITCH-NOTES §d): the coupon picker inline from 768 px; below it, one
 * "คูปอง" row with the held codes as chips and "เลือก", which opens the same picker in a bottom sheet. Manual entry
 * ("มีโค้ดอื่น?") stays under the picker for a code the customer holds on paper. With nothing to pick, or when the
 * picker cannot be read, the summary keeps the plain code box it had.
 */
export function CartCoupons({
  codes,
  maxCodes,
  cartVersion,
  pending,
  onApply,
  onRemove,
  manual,
}: {
  codes: readonly Schemas["CartCodeDto"][];
  maxCodes: number | null;
  /** `CartDto.updatedAt`: a cart edit reads the applicable codes again. */
  cartVersion: string;
  pending: boolean;
  onApply: (code: string) => void | Promise<void>;
  onRemove: (code: string) => void;
  /** The code box's own props (error, note), for manual entry. */
  manual: Pick<PromoCodeBoxProps, "error" | "note">;
}) {
  const t = useTranslations("deals.picker");
  const [open, setOpen] = useState(false);
  const applicable = useQuery({
    queryKey: queryKeys.related("customer", "cart", "applicable-codes", cartVersion),
    queryFn: async () => (await browserApi().GET("/v1/store/cart/applicable-codes")).data!,
    staleTime: 30_000,
  });
  // The public deals' benefits, for each row's stub (a personal coupon has none and shows the ticket mark).
  const deals = useQuery({
    queryKey: queryKeys.list("customer", "deal", {}),
    queryFn: async () => (await browserApi().GET("/v1/store/promotions")).data!,
    staleTime: 60_000,
    enabled: (applicable.data?.applicable.length ?? 0) > 0,
  });
  const benefits = useMemo(
    () => new Map((deals.data?.items ?? []).map((deal) => [deal.id, deal.benefit] as const)),
    [deals.data],
  );

  const data = applicable.data;
  const held = codes.map((entry) => entry.code);
  const offered = new Set(data?.applicable.map((row) => row.code) ?? []);
  // Codes typed by hand stay chips in the code box; picked ones are the ticked rows.
  const typed = codes.filter((entry) => !offered.has(entry.code));
  const max = data?.maxCodes ?? maxCodes;
  const picked = held.filter((code) => offered.has(code)).length;
  const box = (
    <PromoCodeBox
      variant="compact"
      codes={typed}
      maxCodes={max === null ? null : Math.max(0, max - picked)}
      pending={pending}
      onApply={onApply}
      onRemove={onRemove}
      {...manual}
    />
  );

  if (!data || (data.applicable.length === 0 && data.notYet.length === 0)) return box;

  const picker = (bare: boolean) => (
    <CouponPicker
      data={data}
      held={held}
      benefits={benefits}
      pending={pending}
      onApply={(code) => void onApply(code)}
      onRemove={onRemove}
      bare={bare}
    />
  );

  return (
    <>
      <div className="border-border hidden flex-col gap-3 border-t pt-4 md:flex">
        {picker(false)}
        <div>
          <p className="m-0 mb-1.5 text-[0.8125rem] font-medium">{t("manual")}</p>
          {box}
        </div>
      </div>

      <div className="border-border flex min-h-14 items-center gap-2.5 border-t pt-3 md:hidden">
        <span className="text-[0.9375rem] font-semibold">{t("row")}</span>
        <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {held.length > 0 ? (
            held.map((code) => (
              <Badge key={code} size="sm" className="font-semibold tracking-[0.04em]">
                {code}
              </Badge>
            ))
          ) : (
            <span className="text-muted text-sm">{t("none")}</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-primary focus-visible:ring-focus-ring rounded-control inline-flex min-h-11 items-center gap-0.5 px-1 text-sm font-medium outline-none focus-visible:ring-2"
        >
          {t("choose")}
          <Icon name="chevron-right" size={16} aria-hidden="true" />
        </button>
      </div>
      <Sheet
        side="bottom"
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("sheetNote", { count: picked, max: data.maxCodes })}
        closeLabel={t("close")}
        footer={
          <Button size="lg" block onClick={() => setOpen(false)}>
            {t("done")}
          </Button>
        }
      >
        {picker(true)}
        <div className="mt-4">
          <p className="m-0 mb-1.5 text-[0.8125rem] font-medium">{t("manual")}</p>
          {box}
        </div>
      </Sheet>
    </>
  );
}
