"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { CouponDivider, CouponFrame, CouponSavingRow } from "@/ui/components/CouponFrame";
import { IconButton } from "@/ui/components/IconButton";
import { Input } from "@/ui/components/Input";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

/** A promotion the checkout preview has applied: what it is called and what it takes off. */
export interface AppliedPromotion {
  name: string;
  /** Decimal string from the API, formatted with `formatTHB` (never arithmetic). */
  amount: string;
}

export interface PromoCodeBoxProps {
  /** The codes on the cart, as the API reports them (`CartDto.codes`). */
  codes: readonly Schemas["CartCodeDto"][];
  onApply: (code: string) => void | Promise<void>;
  onRemove: (code: string) => void;
  /** An edit is in flight — the controls wait rather than send a second one over it. */
  pending?: boolean;
  /**
   * What the preview says the promotions are worth (`promotion.applied` notices) — only the
   * checkout knows this; the cart shows the codes alone and says the discount is computed next.
   */
  applied?: readonly AppliedPromotion[];
  /** The preview's total discount, shown as "you save" when it is not zero. */
  savings?: string | null;
  /** The last apply the API refused outright (rate limit, unknown code) — shown inline. */
  error?: string | null;
  /** How many codes the cart may hold (`promotions.max_codes_per_cart`, D-053); the box stops at it. */
  maxCodes?: number;
  className?: string;
}

/**
 * The one place a customer enters a discount code.
 *
 * It looks like a coupon rather than another form row, because a customer who has a code is
 * looking for *where to put it*, and a code box that reads as "optional reference" is one they
 * scroll past (UX feedback 2026-10-14). States, each in words and an icon, never colour alone:
 * a code accepted (with its discount when known), a code the cart holds but the preview cannot
 * honour (with the reason), an apply refused by the API (inline, under the input), and the total
 * saved in the heading.
 */
export function PromoCodeBox({
  codes,
  onApply,
  onRemove,
  pending = false,
  applied = [],
  savings = null,
  error = null,
  maxCodes = 3,
  className,
}: PromoCodeBoxProps) {
  const t = useTranslations("cart.promo");
  const format = useFormat();
  const [draft, setDraft] = useState("");
  const id = useId();
  const inputId = `${id}-input`;
  const titleId = `${id}-title`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const full = codes.length >= maxCodes;
  const normalised = draft.trim().toUpperCase();
  const duplicate = normalised !== "" && codes.some((entry) => entry.code === normalised);
  const canApply = normalised !== "" && !duplicate && !full && !pending;
  const hasSavings = typeof savings === "string" && savings !== "0.00";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canApply) return;
    void onApply(normalised);
    setDraft("");
  }

  return (
    <CouponFrame
      className={className}
      titleId={titleId}
      hintId={hintId}
      title={hasSavings ? t("savingTitle", { amount: format.thb(savings) }) : t("title")}
      hint={full ? t("full", { max: maxCodes }) : t("hint", { max: maxCodes })}
    >
      <form onSubmit={submit} className="mt-3 flex items-stretch gap-2">
        <label htmlFor={inputId} className="sr-only">
          {t("label")}
        </label>
        <Input
          id={inputId}
          value={draft}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={32}
          disabled={full || pending}
          placeholder={t("placeholder")}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          aria-invalid={error ? true : undefined}
          inputSize="md"
          className="bg-surface text-sm font-semibold tracking-wider uppercase placeholder:font-normal placeholder:tracking-normal placeholder:normal-case"
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" disabled={!canApply} loading={pending} className="shrink-0">
          {t("apply")}
        </Button>
      </form>

      {duplicate ? (
        <p className="text-muted mt-2 text-[13px]" role="status">
          {t("duplicate", { code: normalised })}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-danger mt-2 flex items-start gap-1.5 text-[13px]" role="alert">
          <Icon name="error" size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}

      {codes.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2" aria-label={t("appliedList")}>
          {codes.map((entry) => {
            const ok = entry.status === "validated";
            return (
              <li
                key={entry.code}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                  ok ? "bg-success-subtle text-success-subtle-fg" : "bg-warning-subtle text-warning-subtle-fg",
                )}
              >
                <Icon name={ok ? "check" : "warning"} size={16} aria-hidden="true" className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <b className="tracking-wider">{entry.code}</b>
                  <span className="ms-2">
                    {ok ? t("accepted") : t("rejected", { reason: entry.rejectReason ?? t("rejectedUnknown") })}
                  </span>
                </span>
                <IconButton
                  name="close"
                  size="sm"
                  variant="ghost"
                  label={t("remove", { code: entry.code })}
                  disabled={pending}
                  onClick={() => onRemove(entry.code)}
                />
              </li>
            );
          })}
        </ul>
      ) : null}

      {applied.length > 0 ? (
        <CouponDivider aria-label={t("savingsList")}>
          {applied.map((promotion, index) => (
            <CouponSavingRow
              key={`${promotion.name}-${index}`}
              name={promotion.name}
              amount={t("minus", { amount: format.thb(promotion.amount) })}
            />
          ))}
        </CouponDivider>
      ) : null}
    </CouponFrame>
  );
}
