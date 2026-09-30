"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { PhoneInput } from "@/ui/components/PhoneInput";

import { geoName, type Address } from "./address";

export type { Address } from "./address";

interface Draft {
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string;
  isDefault: boolean;
}

const fromAddress = (address: Address): Draft => ({
  label: address.label,
  recipientName: address.recipientName,
  phone: address.phone,
  line1: address.line1,
  line2: address.line2 ?? "",
  isDefault: address.isDefault,
});

/**
 * A saved address, edited (design-system.md §3 "AddressForm"): labels above fields, checked on
 * submit, nothing cleared on failure, saved under the `ETag` of a fresh read
 * (`store.addresses.update`, If-Match).
 *
 * CONTRACT-GAP store.geo-ids — an address is filed under a province and sub-district **id**, and no
 * store geo read gives one. So a new address cannot be created yet, and a saved one keeps its area;
 * everything else about it can change.
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
  if (!address) {
    return (
      <div className="flex flex-col gap-4">
        <Callout tone="info" title={t("createBlockedTitle")}>
          {t("createBlocked")}
        </Callout>
        {onCancel ? (
          <div>
            <Button variant="secondary" onClick={onCancel}>
              {t("cancel")}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }
  return <EditAddress address={address} onSaved={onSaved} onCancel={onCancel} />;
}

function EditAddress({
  address,
  onSaved,
  onCancel,
}: {
  address: Address;
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
  const area = [geoName(locale, address.subdistrict), geoName(locale, address.province), address.postcode]
    .filter(Boolean)
    .join(" ");

  function validate() {
    const found: Partial<Record<keyof Draft, string>> = {};
    if (!draft.label.trim()) found.label = t("required");
    if (!draft.recipientName.trim()) found.recipientName = t("required");
    if (!/^0\d{8,9}$/.test(draft.phone)) found.phone = t("phoneInvalid");
    if (!draft.line1.trim()) found.line1 = t("required");
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
    try {
      const api = browserApi();
      const current = await api.GET("/v1/store/addresses/{addressId}", {
        params: { path: { addressId: address.id } },
      });
      const { data } = await api.PATCH("/v1/store/addresses/{addressId}", {
        params: {
          path: { addressId: address.id },
          header: { "If-Match": current.response.headers.get("etag") ?? "" },
        },
        body: {
          label: draft.label.trim(),
          recipientName: draft.recipientName.trim(),
          phone: draft.phone,
          line1: draft.line1.trim(),
          line2: draft.line2.trim() || null,
          isDefault: draft.isDefault,
        },
      });
      onSaved(data!);
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
        <p className="flex flex-col gap-1 self-end pb-2 text-sm">
          <span className="text-muted">{t("areaFixed")}</span>
          <span>{area}</span>
        </p>
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
