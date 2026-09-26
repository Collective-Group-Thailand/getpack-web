"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { toast } from "@/ui/components/Toast";

type Policy = "required" | "optional" | "none";

/**
 * What the company's admin decides (D-123, D-125): the order value above which the approver must
 * approve, and whether a PO number is required. The amount is whole baht as typed, sent as the
 * API's decimal string — nothing is computed from it here.
 */
export function CompanySettings({ threshold, poNumberPolicy }: { threshold: string | null; poNumberPolicy: Policy }) {
  const t = useTranslations("business.settings");
  const router = useRouter();
  const [enabled, setEnabled] = useState(threshold !== null);
  const [amount, setAmount] = useState(threshold ? threshold.replace(/\.00$/, "") : "");
  const [policy, setPolicy] = useState<Policy>(poNumberPolicy);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (enabled && !/^\d{1,9}$/.test(amount)) {
      setError(t("errors.amount"));
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await browserRequests().call("PATCH /v1/store/me/company", {
        body: { orderApprovalThreshold: enabled ? `${amount}.00` : null, poNumberPolicy: policy },
      });
      toast.success(t("saved"));
      router.refresh();
    } catch (failure) {
      toast.error(isApiError(failure) ? failure.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form noValidate onSubmit={(event) => void save(event)} className="flex max-w-xl flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-semibold">{t("approvalTitle")}</legend>
        <Checkbox
          checked={enabled}
          onCheckedChange={(value) => setEnabled(value === true)}
          label={t("approvalOn")}
          description={t("approvalHint")}
        />
        {enabled ? (
          <Field label={t("threshold")} hint={t("thresholdHint")} error={error}>
            <Input
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
              className="max-w-48"
            />
          </Field>
        ) : null}
      </fieldset>
      <Field label={t("poTitle")}>
        <RadioCards
          value={policy}
          onValueChange={setPolicy}
          options={(["required", "optional", "none"] as const).map((value) => ({
            value,
            label: t(`po.${value}`),
            description: t(`poHints.${value}`),
          }))}
        />
      </Field>
      <Button type="submit" className="self-start" loading={busy}>
        {t("save")}
      </Button>
    </form>
  );
}
