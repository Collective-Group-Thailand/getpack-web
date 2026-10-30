"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";

/**
 * "ล็อกราคาไว้เรียกของทีละงวด" on a saved quotation (U2.F5, D-290): ask its factory to lock the
 * option's unit price for its quantity for some months; releases are taken later, each a normal
 * order. No deposit, no stock; what is not released lapses without charge.
 */
export function RequestCallOff({ quoteId, optionId, label }: { quoteId: string; optionId: string; label: string }) {
  const t = useTranslations("account.callOffs.request");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" iconStart="calendar" onClick={() => setOpen(true)}>
        {t("open")}
        <span className="sr-only"> {label}</span>
      </Button>
      <RequestCallOffDialog quoteId={quoteId} optionId={optionId} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** The request itself, opened from the button above or from a saved quotation's row menu. */
export function RequestCallOffDialog({
  quoteId,
  optionId,
  open,
  onOpenChange,
}: {
  quoteId: string;
  optionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("account.callOffs.request");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [months, setMonths] = useState("6");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const { data } = await browserApi().POST("/v1/store/call-off-agreements", {
        params: { header: { "Idempotency-Key": newIdempotencyKey() } },
        body: { quoteId, quoteOptionId: optionId, months: Number(months) },
      });
      router.push(`/account/call-offs/${data!.id}`);
    } catch (error) {
      setProblem(isApiError(error) ? error.detail : t("failed"));
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => !next && !busy && onOpenChange(false)}
        title={t("title")}
        description={t("body")}
        closeLabel={tCommon("actions.close")}
        footer={
          <Button loading={busy} onClick={() => void send()}>
            {t("send")}
          </Button>
        }
      >
        <Field label={t("months")}>
          <SearchableSelect
            value={months}
            onValueChange={setMonths}
            options={["3", "6", "9", "12"].map((value) => ({
              value,
              label: t("monthsValue", { count: Number(value) }),
            }))}
          />
        </Field>
        {problem ? <Callout tone="danger" title={problem} className="mt-3" /> : null}
      </Dialog>
    </>
  );
}
