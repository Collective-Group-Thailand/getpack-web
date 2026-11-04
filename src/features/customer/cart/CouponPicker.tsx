"use client";

import { useTranslations } from "next-intl";

import { MiniStub, useDealStub } from "@/features/shared/deals/DealCard";
import { pickerRowState, sortApplicable, type PickerRowState } from "@/features/shared/deals/model";
import { useFormat } from "@/features/shared/format/useFormat";
import type { ApplicableCode, ApplicableCodes, Deal } from "@/lib/api/requests/store-deals";
import { Badge } from "@/ui/components/Badge";
import { Checkbox } from "@/ui/components/Checkbox";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export interface CouponPickerProps {
  data: ApplicableCodes;
  /** The codes the cart holds now (`CartDto.codes`, validated or not). */
  held: readonly string[];
  /** Benefits of public deals by promotion id, for the mini-stubs; a personal coupon shows a ticket mark. */
  benefits?: ReadonlyMap<string, Deal["benefit"]>;
  /** A cart edit is in flight: every box waits. */
  pending?: boolean;
  onApply: (code: string) => void;
  onRemove: (code: string) => void;
  /** Without the heading row — the sheet has its own title. */
  bare?: boolean;
  className?: string;
}

/**
 * "คูปองที่ใช้ได้กับตะกร้านี้" (loyalty P1.5, STITCH-NOTES §d; prototype `p15-cart-coupons.html`): the codes the
 * customer holds that `checkCode` accepts for this cart (`store.cart.applicableCodes`), as checkboxes — the cart holds
 * up to `maxCodes` (D-452). Each row: mini-stub · code (+ "คุ้มที่สุด") · benefit · the API's saving in `success`. A
 * code that cannot stack with a held one is disabled with "ใช้ร่วมกับ X ไม่ได้"; a full cart disables the rest. Then
 * "ยังใช้ไม่ได้" with each reason as text. Ticking applies the code to the cart, as typing it would; there is no
 * total — the web never adds money, the checkout shows the combined discount.
 */
export function CouponPicker({
  data,
  held,
  benefits,
  pending = false,
  onApply,
  onRemove,
  bare = false,
  className,
}: CouponPickerProps) {
  const t = useTranslations("deals.picker");
  const rows = sortApplicable(data.applicable);
  const chosen = rows.filter((row) => held.includes(row.code)).length;
  return (
    <section
      aria-labelledby={bare ? undefined : "coupon-picker-title"}
      aria-label={bare ? t("title") : undefined}
      className={className}
    >
      {bare ? null : (
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="coupon-picker-title" className="m-0 text-[0.9375rem] font-semibold">
            {t("title")}
          </h3>
          <span className="text-muted text-xs tabular-nums">{t("chosen", { count: chosen, max: data.maxCodes })}</span>
        </div>
      )}
      {rows.length > 0 ? (
        <ul className="m-0 mt-2.5 flex list-none flex-col gap-2 p-0">
          {rows.map((row) => (
            <PickerRow
              key={row.code}
              row={row}
              state={pickerRowState(row, held, rows, data.maxCodes)}
              benefit={benefits?.get(row.promotionId) ?? null}
              pending={pending}
              onApply={onApply}
              onRemove={onRemove}
            />
          ))}
        </ul>
      ) : null}
      {data.notYet.length > 0 ? (
        <>
          <p className="text-muted m-0 mt-4 text-[0.8125rem] font-semibold">
            {t("notYet")} <span className="tabular-nums">{data.notYet.length}</span>
          </p>
          <ul className="divide-border m-0 mt-1 flex list-none flex-col divide-y p-0">
            {data.notYet.map((row) => (
              <li key={row.code} className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-3 py-2">
                <StubFor benefit={null} spent />
                <span className="flex min-w-0 flex-col leading-snug">
                  <span className="text-muted text-[0.8125rem] font-semibold tracking-[0.04em]">{row.code}</span>
                  <span className="text-muted truncate text-[0.8125rem]">{row.headline}</span>
                  <span className="text-fg text-[0.8125rem]">{row.reasonText}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

function PickerRow({
  row,
  state,
  benefit,
  pending,
  onApply,
  onRemove,
}: {
  row: ApplicableCode;
  state: PickerRowState;
  benefit: Deal["benefit"] | null;
  pending: boolean;
  onApply: (code: string) => void;
  onRemove: (code: string) => void;
}) {
  const t = useTranslations("deals.picker");
  const format = useFormat();
  const applied = state.kind === "applied";
  const blocked = state.kind === "conflict" || state.kind === "full";
  const note =
    state.kind === "conflict"
      ? t("conflict", { code: state.with })
      : state.kind === "full"
        ? t("full", { max: state.max })
        : null;
  return (
    <li
      className={cn(
        "rounded-xl border px-3 py-2.5",
        applied ? "border-primary ring-primary ring-1 ring-inset" : "border-border",
      )}
    >
      <Checkbox
        stretch
        className="items-center"
        checked={applied}
        disabled={pending || blocked}
        aria-label={applied ? t("remove", { code: row.code }) : t("apply", { code: row.code })}
        onCheckedChange={(checked) => (checked === true ? onApply(row.code) : onRemove(row.code))}
        label={
          <span className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3">
            <StubFor benefit={benefit} />
            <span className="flex min-w-0 flex-col leading-snug">
              <span
                className={cn(
                  "flex items-center gap-2 text-[0.84375rem] font-semibold tracking-[0.04em]",
                  blocked && "text-muted",
                )}
              >
                {row.code}
                {row.best ? (
                  <Badge tone="primary" size="sm" className="tracking-normal">
                    {t("best")}
                  </Badge>
                ) : null}
              </span>
              <span className="text-muted truncate text-[0.8125rem]">{row.benefitSummary}</span>
              {note ? (
                <span className="text-muted mt-0.5 flex items-center gap-1.5 text-xs">
                  <Icon name="info" size={14} aria-hidden="true" className="shrink-0" />
                  {note}
                </span>
              ) : null}
            </span>
            <span
              className={cn(
                "self-start pt-0.5 text-[0.90625rem] font-semibold tabular-nums",
                blocked ? "text-subtle" : "text-success",
              )}
            >
              {t("saving", { amount: format.thb(row.saving) })}
            </span>
          </span>
        }
      />
    </li>
  );
}

/** A public deal's own stub; a personal coupon (no public deal) shows the ticket mark. */
function StubFor({ benefit, spent = false }: { benefit: Deal["benefit"] | null; spent?: boolean }) {
  if (!benefit)
    return <MiniStub size="sm" spent={spent} word={null} wordFigure figure={<Icon name="ticket" size={18} />} />;
  return <BenefitStub benefit={benefit} spent={spent} />;
}

function BenefitStub({ benefit, spent }: { benefit: Deal["benefit"]; spent: boolean }) {
  const stub = useDealStub(benefit);
  return (
    <MiniStub
      size="sm"
      spent={spent}
      word={stub.word}
      figure={stub.figureText}
      wordFigure={stub.value.figure.kind === "word"}
    />
  );
}
