"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRefresh } from "@/features/partner/client";
import { ConfirmAction, problemMessage } from "@/features/shared/actions";
import { p4ProblemKey } from "@/features/shared/loyalty-p4/problems";
import { browserRequests } from "@/lib/api/requests/browser";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

function useMessage() {
  const t = useTranslations("partnerBilling.cofunding.problems");
  return (error: unknown, fallback: string) => {
    const key = p4ProblemKey(error);
    return key && t.has(key) ? t(key) : problemMessage(error, fallback);
  };
}

/**
 * "ตอบรับข้อเสนอ" (loyalty P4, D-506): asks once, restating what the factory pays, where it is netted and what happens
 * on a cancel; one `Idempotency-Key` per opening. Only offered when the API lists `accept` in `nextActions`.
 */
export function AcceptOffer({
  offerId,
  terms,
  window,
  block = true,
}: {
  offerId: string;
  terms: string;
  window: string;
  block?: boolean;
}) {
  const t = useTranslations("partnerBilling.cofunding.accept");
  const message = useMessage();
  const [refresh] = useRefresh();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="lg" block={block} iconStart="check" onClick={() => setOpen(true)}>
        {t("action")}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={
          <span className="flex flex-col gap-2">
            <span>{t("body", { terms, window })}</span>
            <span className="text-muted">{t("netting")}</span>
            <span className="text-muted">{t("refund")}</span>
          </span>
        }
        confirmLabel={t("confirm")}
        onConfirm={async ({ idempotencyKey }) => {
          try {
            await browserRequests().call("POST /v1/partner/cofunding-offers/{offerId}/actions/accept", {
              path: { offerId },
              body: {},
              idempotencyKey,
            });
            toast.success(t("done"));
            refresh();
          } catch (error) {
            toast.error(message(error, t("failed")));
            throw error;
          }
        }}
      />
    </>
  );
}

/** "ปฏิเสธ": a short reason (≥ 5), never affects routing. */
export function DeclineOffer({ offerId, block = true }: { offerId: string; block?: boolean }) {
  const t = useTranslations("partnerBilling.cofunding.decline");
  const message = useMessage();
  const [refresh] = useRefresh();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="lg" block={block} variant="secondary" onClick={() => setOpen(true)}>
        {t("action")}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("body")}
        confirmLabel={t("confirm")}
        reason={{ label: t("reason"), required: true, minLength: 5, hint: t("reasonHint") }}
        onConfirm={async ({ idempotencyKey, reason }) => {
          try {
            await browserRequests().call("POST /v1/partner/cofunding-offers/{offerId}/actions/decline", {
              path: { offerId },
              body: { reason },
              idempotencyKey,
            });
            toast.success(t("done"));
            refresh();
          } catch (error) {
            toast.error(message(error, t("failed")));
            throw error;
          }
        }}
      />
    </>
  );
}
