"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { PhoneInput } from "@/ui/components/PhoneInput";
import { Select } from "@/ui/components/Select";

export type Address = ResponseOf<Requests, "GET /v1/store/me/addresses">["data"][number];

interface Draft {
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string;
  postcode: string;
  province: string;
  district: string;
  subdistrict: string;
  isDefault: boolean;
}

const fromAddress = (address?: Address): Draft => ({
  label: address?.label ?? "",
  recipientName: address?.recipientName ?? "",
  phone: address?.phone ?? "",
  line1: address?.line1 ?? "",
  line2: address?.line2 ?? "",
  postcode: address?.postcode ?? "",
  province: address?.province ?? "",
  district: address?.district ?? "",
  subdistrict: address?.subdistrict ?? "",
  isDefault: address?.isDefault ?? false,
});

/**
 * An address, Thai style (design-system.md §3 "AddressForm"): the postcode first, which names the
 * province and district and offers its sub-districts (published `store.catalog.geo`), so nobody
 * types a province. Labels above fields, checked on submit, nothing cleared on failure.
 */
export function AddressForm({
  address,
  onSaved,
  onCancel,
}: {
  address?: Address;
  onSaved: (address: Address) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("account.addressForm");
  const locale = useLocale();
  const [draft, setDraft] = useState<Draft>(() => fromAddress(address));
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const lookup = useQuery({
    queryKey: [...queryKeys.zone("customer"), "postcode", draft.postcode],
    queryFn: async ({ signal }) =>
      (
        await browserApi().GET("/v1/store/catalog/geo/postcodes/{postcode}", {
          params: { path: { postcode: draft.postcode } },
          signal,
        })
      ).data ?? [],
    enabled: /^\d{5}$/.test(draft.postcode),
    staleTime: Infinity,
  });
  const areas = lookup.data ?? [];
  const areaName = (area: { nameTh: string; nameEn: string }) => pick(locale, area.nameTh, area.nameEn);

  function validate() {
    const found: Partial<Record<keyof Draft, string>> = {};
    if (!draft.label.trim()) found.label = t("required");
    if (!draft.recipientName.trim()) found.recipientName = t("required");
    if (!/^0\d{8,9}$/.test(draft.phone)) found.phone = t("phoneInvalid");
    if (!draft.line1.trim()) found.line1 = t("required");
    if (!/^\d{5}$/.test(draft.postcode)) found.postcode = t("postcodeInvalid");
    if (!draft.province.trim()) found.province = t("required");
    return found;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setFailure(null);
    const body = {
      label: draft.label.trim(),
      recipientName: draft.recipientName.trim(),
      phone: draft.phone,
      line1: draft.line1.trim(),
      ...(draft.line2.trim() ? { line2: draft.line2.trim() } : {}),
      ...(draft.subdistrict ? { subdistrict: draft.subdistrict } : {}),
      ...(draft.district ? { district: draft.district } : {}),
      province: draft.province,
      postcode: draft.postcode,
      isDefault: draft.isDefault,
    };
    try {
      const saved = address
        ? await browserRequests().call("PATCH /v1/store/me/addresses/{addressId}", {
            path: { addressId: address.id },
            body,
          })
        : await browserRequests().call("POST /v1/store/me/addresses", { body });
      onSaved(saved);
    } catch (error) {
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("label")} hint={t("labelHint")} error={errors.label} required requiredLabel={t("requiredMark")}>
          <Input value={draft.label} onChange={(event) => set({ label: event.target.value })} />
        </Field>
        <Field label={t("recipient")} error={errors.recipientName} required requiredLabel={t("requiredMark")}>
          <Input
            autoComplete="name"
            value={draft.recipientName}
            onChange={(event) => set({ recipientName: event.target.value })}
          />
        </Field>
        <Field label={t("phone")} error={errors.phone} required requiredLabel={t("requiredMark")}>
          <PhoneInput value={draft.phone} onChange={(phone) => set({ phone })} />
        </Field>
        <Field
          label={t("postcode")}
          hint={t("postcodeHint")}
          error={errors.postcode}
          required
          requiredLabel={t("requiredMark")}
        >
          <Input
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            value={draft.postcode}
            onChange={(event) => {
              const postcode = event.target.value.replace(/\D/g, "").slice(0, 5);
              set({ postcode, province: "", district: "", subdistrict: "" });
            }}
          />
        </Field>
        {areas.length > 0 ? (
          <>
            <Field label={t("subdistrict")}>
              <Select
                value={draft.subdistrict || undefined}
                placeholder={t("choose")}
                onValueChange={(code) => {
                  const area = areas.find((candidate) => candidate.subdistrict.code === code);
                  if (!area) return;
                  set({
                    subdistrict: areaName(area.subdistrict),
                    district: areaName(area.district),
                    province: areaName(area.province),
                  });
                }}
                options={areas.map((area) => ({ value: area.subdistrict.code, label: areaName(area.subdistrict) }))}
              />
            </Field>
            <p className="text-muted self-end pb-2 text-sm" aria-live="polite">
              {draft.province
                ? t("area", { district: draft.district, province: draft.province })
                : t("pickSubdistrict")}
            </p>
          </>
        ) : lookup.isSuccess ? (
          <Field
            label={t("province")}
            error={errors.province ?? t("postcodeUnknown")}
            required
            requiredLabel={t("requiredMark")}
          >
            <Input value={draft.province} onChange={(event) => set({ province: event.target.value })} />
          </Field>
        ) : null}
        <Field
          label={t("line1")}
          hint={t("line1Hint")}
          error={errors.line1}
          required
          requiredLabel={t("requiredMark")}
          className="sm:col-span-2"
        >
          <Input
            autoComplete="address-line1"
            value={draft.line1}
            onChange={(event) => set({ line1: event.target.value })}
          />
        </Field>
        <Field label={t("line2")} className="sm:col-span-2">
          <Input
            autoComplete="address-line2"
            value={draft.line2}
            onChange={(event) => set({ line2: event.target.value })}
          />
        </Field>
      </div>
      {errors.province && areas.length > 0 ? (
        <p className="text-danger text-xs font-medium">{t("pickSubdistrict")}</p>
      ) : null}
      <Checkbox
        checked={draft.isDefault}
        onCheckedChange={(checked) => set({ isDefault: checked === true })}
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
