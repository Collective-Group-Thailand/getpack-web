"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { CodeBox } from "@/features/shared/deals/DealCard";
import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import type { RewardItem, RewardPreview, RewardRedemption } from "@/features/shared/loyalty-p3/types";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { IconButton } from "@/ui/components/IconButton";
import { Sheet, SheetClose } from "@/ui/components/Sheet";
import { Ticket } from "@/ui/components/Ticket";
import { Icon } from "@/ui/icons";

import { PROBLEM_OF_REASON } from "./model";
import { RewardStub } from "./RewardCard";

/** The problem codes the sheet words itself; anything else is the generic line. */
const KNOWN_ERRORS = new Set([
  "rewards.insufficient_points",
  "rewards.tier_required",
  "rewards.frequency_limit",
  "rewards.open_limit",
  "rewards.account_held",
  "rewards.cost_changed",
  "http.not_found",
]);

export interface RedeemSheetProps {
  item: RewardItem | null;
  onOpenChange: (open: boolean) => void;
  /** After a redeem: the page refreshes the catalogue and "คูปองของฉัน". */
  onRedeemed: (redemption: RewardRedemption) => void;
  /** Storybook / tests: open on the success state with this coupon. */
  initialResult?: RewardRedemption | null;
  /** Storybook / tests: the preview instead of reading `store.rewards.preview`. */
  initialPreview?: RewardPreview | null;
}

/**
 * Confirm a redeem (loyalty P3; prototype `p3-redeem.html`): a 440 px dialog from 768 px, a bottom sheet below. The
 * sentence that matters — "ใช้ 60 แต้ม · คงเหลือ 1,190 แต้ม", the balance after from `store.rewards.preview` (the web
 * subtracts nothing; until the preview answers, the sentence states the cost alone) — then two quiet facts (how long the coupon lasts, the
 * cancel rule), "ไว้ก่อน" and the filled "ยืนยันแลก 60 แต้ม". One idempotency key per opening, so a retry after a
 * timeout replays the same redeem. Success replaces the content: the coupon as a ticket with its code, the API's
 * balance after, and "ใช้กับตะกร้า". No checkbox, no second confirmation, no countdown.
 */
export function RedeemSheet({
  item,
  onOpenChange,
  onRedeemed,
  initialResult = null,
  initialPreview = null,
}: RedeemSheetProps) {
  const t = useTranslations("account.rewards.sheet");
  const format = useFormat();
  const [key, setKey] = useState(() => newIdempotencyKey());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RewardRedemption | null>(initialResult);
  const [preview, setPreview] = useState<RewardPreview | null>(initialPreview);
  const itemId = item?.id ?? null;

  useEffect(() => {
    if (itemId === null || initialPreview) return;
    let live = true;
    browserApi()
      .GET("/v1/store/rewards/{itemId}/preview", { params: { path: { itemId } } })
      .then(({ data }) => {
        if (live && data) setPreview(data);
      })
      // Without a preview the sheet states the cost alone; the redeem itself still decides.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [itemId, initialPreview]);

  const close = (open: boolean) => {
    if (open) return;
    onOpenChange(false);
    // The next opening is a new intent.
    setKey(newIdempotencyKey());
    setError(null);
    setResult(null);
    setPreview(initialPreview);
  };

  const redeem = async () => {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await browserApi().POST("/v1/store/rewards/{itemId}/actions/redeem", {
        params: { path: { itemId: item.id }, header: { "Idempotency-Key": key } },
        body: { expectedCostPoints: preview?.costPoints ?? item.costPoints },
      });
      const redemption = data!;
      setResult(redemption);
      onRedeemed(redemption);
    } catch (problem) {
      const code = isApiError(problem) ? problem.code : null;
      setError(code && KNOWN_ERRORS.has(code) ? t(`errors.${code.replace(".", "_")}`) : t("errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  const cost = item ? format.number(preview?.costPoints ?? item.costPoints) : "";
  const refusal = preview && !preview.eligible && preview.reason ? PROBLEM_OF_REASON[preview.reason] : null;
  const cancelWindowDays = item?.cancelWindowDays ?? null;
  const conditions = item?.conditions.join(" · ") ?? "";

  return (
    <Sheet
      open={item !== null}
      onOpenChange={close}
      title={result ? t("doneTitle") : t("title")}
      closeLabel={t("close")}
      appearance="bare"
      className="md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[27.5rem] md:-translate-x-1/2 md:-translate-y-1/2"
    >
      {item ? (
        <div className="bg-surface shadow-overlay md:rounded-panel rounded-t-card">
          <span aria-hidden="true" className="bg-border rounded-thumb mx-auto mt-2 block h-1 w-9 md:hidden" />
          {result ? (
            <>
              <div className="flex items-start justify-between gap-3 px-5 pt-4 md:pt-5">
                <span className="bg-success-subtle text-success-subtle-fg grid size-10 place-items-center rounded-full">
                  <Icon name="check" size={20} aria-hidden="true" />
                </span>
                <SheetClose asChild>
                  <IconButton name="close" label={t("close")} size="sm" />
                </SheetClose>
              </div>
              <div className="px-5 pt-3 pb-5">
                <p className="text-lg leading-snug font-semibold">{t("doneTitle")}</p>
                {result.balanceAfter !== null ? (
                  <p className="text-muted mt-0.5 text-sm tabular-nums">
                    {t("left", { points: format.number(result.balanceAfter) })}
                  </p>
                ) : null}
                <Ticket
                  className="mt-4"
                  orientation="horizontal"
                  stubSize={96}
                  stubClassName="flex flex-col items-center justify-center gap-0.5 px-2 text-center leading-tight"
                  bodyClassName="min-w-0 gap-2 px-4 py-3.5"
                  stub={
                    <>
                      <span className="text-lg font-semibold">{item.valueText}</span>
                    </>
                  }
                >
                  <CodeBox code={result.coupon.code} className="self-start" />
                  <span className="text-muted text-[0.8125rem]">
                    {[t("validUntil", { date: format.date(result.coupon.expiresAt) }), conditions]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </Ticket>
                {result.cancellableUntil ? (
                  <p className="text-muted mt-3 text-[0.8125rem]">
                    {t("cancelUntil", { date: format.dateTime(result.cancellableUntil) })}
                  </p>
                ) : null}
                <div className="mt-6 flex flex-col-reverse gap-2 md:flex-row md:justify-end">
                  <SheetClose asChild>
                    <Button variant="ghost" className="max-md:h-12">
                      {t("more")}
                    </Button>
                  </SheetClose>
                  <Button asChild iconStart="cart" className="max-md:h-12">
                    <Link href="/cart">{t("useInCart")}</Link>
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 px-5 pt-3 md:pt-5">
                <p className="text-lg leading-snug font-semibold">{t("title")}</p>
                <SheetClose asChild>
                  <IconButton name="close" label={t("close")} size="sm" />
                </SheetClose>
              </div>
              <div className="px-5 pt-4 pb-5">
                <div className="border-border rounded-card grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-3.5 border p-3">
                  <RewardStub value={cost} unit={t("unit")} />
                  <div className="min-w-0">
                    <p className="text-[0.9375rem] leading-snug font-semibold">{item.name}</p>
                    {conditions ? <p className="text-muted text-[0.8125rem]">{conditions}</p> : null}
                  </div>
                </div>
                <p className="mt-[1.125rem] text-[1.1875rem] font-semibold tracking-[-0.005em] tabular-nums">
                  {t("spend", { points: cost })}
                  {preview?.balanceAfter != null ? (
                    <>
                      <span aria-hidden="true" className="text-subtle mx-1.5 font-normal">
                        ·
                      </span>
                      {t("after", { points: format.number(preview.balanceAfter) })}
                    </>
                  ) : null}
                </p>
                <ul className="text-muted m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0 text-[0.84375rem]">
                  <li className="flex items-start gap-2">
                    <Icon name="calendar" size={15} aria-hidden="true" className="text-subtle mt-[3px] shrink-0" />
                    {t("validity", { days: item.validityDays })}
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon name="undo" size={15} aria-hidden="true" className="text-subtle mt-[3px] shrink-0" />
                    {cancelWindowDays ? t("cancelRule", { days: cancelWindowDays }) : t("cancelRuleGeneric")}
                  </li>
                </ul>
                {error || refusal ? (
                  <Callout tone="danger" className="mt-4" live>
                    {error ?? t(`errors.${refusal!.replace(".", "_")}`)}
                  </Callout>
                ) : null}
                <div className="mt-[1.375rem] flex flex-col-reverse gap-2 md:flex-row md:justify-end">
                  <SheetClose asChild>
                    <Button variant="ghost" className="max-md:h-12">
                      {t("notNow")}
                    </Button>
                  </SheetClose>
                  <Button
                    loading={busy}
                    disabled={refusal !== null}
                    className="max-md:h-12"
                    onClick={() => void redeem()}
                  >
                    {t("confirm", { points: cost })}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </Sheet>
  );
}
