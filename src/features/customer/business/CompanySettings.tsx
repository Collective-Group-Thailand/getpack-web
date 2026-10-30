"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { browserApi } from "@/lib/api/browser";
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
 * API's decimal string — nothing is computed from it here. Saved under the `ETag` of a fresh read
 * (`store.companies.updateSettings`, If-Match).
 */
export function CompanySettings({
  companyId,
  threshold,
  poNumberPolicy,
}: {
  companyId: string;
  threshold: string | null;
  poNumberPolicy: Policy;
}) {
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
      const api = browserApi();
      const current = await api.GET("/v1/store/companies/{companyId}", { params: { path: { companyId } } });
      await api.PATCH("/v1/store/companies/{companyId}", {
        params: { path: { companyId }, header: { "If-Match": current.response.headers.get("etag") ?? "" } },
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
    // Project C: each setting its own card; the save button closes the last one.
    <form noValidate onSubmit={(event) => void save(event)} className="flex max-w-3xl flex-col gap-4">
      <fieldset className="border-border bg-surface rounded-card flex flex-col gap-3 border p-4 sm:p-5">
        <legend className="float-left mb-2 w-full text-lg font-semibold">{t("approvalTitle")}</legend>
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
      <div className="border-border bg-surface rounded-card border p-4 sm:p-5">
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
        <div className="border-border mt-5 flex justify-end border-t pt-4">
          <Button type="submit" loading={busy}>
            {t("save")}
          </Button>
        </div>
      </div>
    </form>
  );
}
