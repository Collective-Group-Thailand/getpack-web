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
  /**
   * How many codes the cart may hold (`CartDto.maxCodes` = `promotions.max_codes_per_cart`, D-452); the box stops at
   * it. Null: the API enforces its limit and the box names none.
   */
  maxCodes?: number | null;
  /**
   * `coupon` (default): the coupon-shaped box. `compact`: the order summary's form, chips and one line of small print
   * (checkout redesign item 6) — same states, same words.
   */
  variant?: "coupon" | "compact";
  /** Small print after the limit (compact): "คะแนนสะสมใช้ได้ในขั้นชำระเงิน". */
  note?: string;
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
  maxCodes = null,
  variant = "coupon",
  note,
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

  const full = maxCodes !== null && codes.length >= maxCodes;
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

  const hint = full
    ? t("full", { max: maxCodes ?? 0 })
    : maxCodes !== null
      ? t("hint", { max: maxCodes })
      : t("hintNoMax");

  if (variant === "compact")
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <form onSubmit={submit} className="flex items-stretch gap-1.5">
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
            placeholder={t("placeholderCompact")}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            aria-invalid={error ? true : undefined}
            inputSize="md"
            className="bg-surface min-w-0 flex-1 text-sm uppercase placeholder:normal-case"
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={!canApply} loading={pending} className="shrink-0">
            {t("apply")}
          </Button>
        </form>
        {duplicate ? (
          <p className="text-muted m-0 text-[13px]" role="status">
            {t("duplicate", { code: normalised })}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="text-danger m-0 flex items-start gap-1.5 text-[13px]" role="alert">
            <Icon name="error" size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : null}
        {codes.length > 0 ? (
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label={t("appliedList")}>
            {codes.map((entry) => {
              const ok = entry.status === "validated";
              return (
                <li
                  key={entry.code}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md py-0.5 ps-2.5 pe-0.5 text-[12.5px] font-semibold tracking-wider",
                    ok ? "bg-primary-subtle text-primary" : "bg-warning-subtle text-warning-subtle-fg",
                  )}
                  title={ok ? t("accepted") : t("rejected", { reason: entry.rejectReason ?? t("rejectedUnknown") })}
                >
                  {ok ? null : <Icon name="warning" size={14} aria-hidden="true" />}
                  {entry.code}
                  <span className="sr-only">
                    {ok ? t("accepted") : t("rejected", { reason: entry.rejectReason ?? t("rejectedUnknown") })}
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
        {codes.some((entry) => entry.status !== "validated") ? (
          <p className="text-warning-subtle-fg m-0 text-xs">
            {codes
              .filter((entry) => entry.status !== "validated")
              .map((entry) => `${entry.code}: ${entry.rejectReason ?? t("rejectedUnknown")}`)
              .join(" · ")}
          </p>
        ) : null}
        {applied.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]" aria-label={t("savingsList")}>
            {applied.map((promotion, index) => (
              <li key={`${promotion.name}-${index}`} className="flex justify-between gap-3">
                <span className="text-muted min-w-0">{promotion.name}</span>
                <span className="text-success-subtle-fg shrink-0 font-medium tabular-nums">
                  {t("minus", { amount: format.thb(promotion.amount) })}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <small id={hintId} className="text-muted text-xs">
          {note ? `${hint} · ${note}` : hint}
        </small>
      </div>
    );

  return (
    <CouponFrame
      className={className}
      titleId={titleId}
      hintId={hintId}
      title={hasSavings ? t("savingTitle", { amount: format.thb(savings) }) : t("title")}
      hint={hint}
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
