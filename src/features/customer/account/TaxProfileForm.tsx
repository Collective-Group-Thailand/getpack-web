"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

import { isValidThaiTaxId } from "./tax-id";

export type TaxProfile = ResponseOf<Requests, "GET /v1/store/me/tax-profiles">["data"][number];
type TaxType = TaxProfile["taxType"];

/**
 * Who the tax invoice is made out to (D-125): a person, a company or a government body; the head
 * office or a numbered branch; and whether the customer withholds tax (the API computes the
 * amount and it is shown at checkout).
 */
export function TaxProfileForm({
  profile,
  onSaved,
  onCancel,
}: {
  profile?: TaxProfile;
  onSaved: (profile: TaxProfile) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("account.taxForm");
  const [taxType, setTaxType] = useState<TaxType>(profile?.taxType ?? "juristic");
  const [name, setName] = useState(profile?.name ?? "");
  const [taxId, setTaxId] = useState(profile?.taxId ?? "");
  const [branchType, setBranchType] = useState<"head_office" | "branch">(profile?.branchType ?? "head_office");
  const [branchCode, setBranchCode] = useState(profile && profile.branchType === "branch" ? profile.branchCode : "");
  const [address, setAddress] = useState(profile?.address ?? "");
  const [withholdsTax, setWithholdsTax] = useState(profile?.withholdsTax ?? false);
  const [isDefault, setIsDefault] = useState(profile?.isDefault ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = t("required");
    if (!isValidThaiTaxId(taxId)) found.taxId = t("taxIdInvalid");
    if (branchType === "branch" && !/^\d{5}$/.test(branchCode)) found.branchCode = t("branchInvalid");
    if (!address.trim()) found.address = t("required");
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setFailure(null);
    const body = {
      taxType,
      name: name.trim(),
      taxId,
      branchType,
      branchCode: branchType === "head_office" ? "00000" : branchCode,
      address: address.trim(),
      withholdsTax: taxType !== "individual" && withholdsTax,
      isDefault,
    };
    try {
      const saved = profile
        ? await browserRequests().call("PATCH /v1/store/me/tax-profiles/{profileId}", {
            path: { profileId: profile.id },
            body,
          })
        : await browserRequests().call("POST /v1/store/me/tax-profiles", { body });
      onSaved(saved);
    } catch (error) {
      if (isApiError(error) && error.errors.some((item) => item.path === "taxId"))
        setErrors({ taxId: t("taxIdInvalid") });
      setFailure(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form noValidate onSubmit={(event) => void save(event)} className="flex flex-col gap-4">
      {failure ? (
        <Callout tone="danger" live>
          {failure}
        </Callout>
      ) : null}
      <Field label={t("type")}>
        <RadioCards
          columns={3}
          value={taxType}
          onValueChange={(value) => setTaxType(value as TaxType)}
          options={(["individual", "juristic", "government"] as const).map((value) => ({
            value,
            label: t(`types.${value}`),
          }))}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={taxType === "individual" ? t("personName") : t("companyName")}
          error={errors.name}
          required
          requiredLabel={t("requiredMark")}
        >
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label={t("taxId")} hint={t("taxIdHint")} error={errors.taxId} required requiredLabel={t("requiredMark")}>
          <Input
            inputMode="numeric"
            maxLength={13}
            value={taxId}
            onChange={(event) => setTaxId(event.target.value.replace(/\D/g, "").slice(0, 13))}
            className="tabular-nums"
          />
        </Field>
      </div>
      {taxType !== "individual" ? (
        <div className="flex flex-wrap items-end gap-4">
          <SegmentedControl
            label={t("branch")}
            value={branchType}
            onValueChange={setBranchType}
            options={[
              { value: "head_office", label: t("headOffice") },
              { value: "branch", label: t("branchOffice") },
            ]}
          />
          {branchType === "branch" ? (
            <Field label={t("branchCode")} error={errors.branchCode} required requiredLabel={t("requiredMark")}>
              <Input
                inputMode="numeric"
                maxLength={5}
                value={branchCode}
                onChange={(event) => setBranchCode(event.target.value.replace(/\D/g, "").slice(0, 5))}
                className="w-28"
              />
            </Field>
          ) : null}
        </div>
      ) : null}
      <Field
        label={t("address")}
        hint={t("addressHint")}
        error={errors.address}
        required
        requiredLabel={t("requiredMark")}
      >
        <Textarea rows={3} value={address} onChange={(event) => setAddress(event.target.value)} />
      </Field>
      {taxType !== "individual" ? (
        <Checkbox
          checked={withholdsTax}
          onCheckedChange={(checked) => setWithholdsTax(checked === true)}
          label={t("withholds")}
          description={t("withholdsHint")}
        />
      ) : null}
      <Checkbox
        checked={isDefault}
        onCheckedChange={(checked) => setIsDefault(checked === true)}
        label={t("default")}
      />
      <div className="flex gap-2">
        <Button type="submit" loading={saving}>
          {t("save")}
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            {t("cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
