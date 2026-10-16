"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { useFormat } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, FormDialog, FormError, useCan } from "../console";
import { useGeoName, usePostcodeAreas } from "./geo";

type Address = Schemas["AddressDto"];

/**
 * CS corrects a customer's address (D-142): the address is read again for its ETag, so a change
 * the customer made meanwhile is not overwritten. Orders already placed keep their snapshot.
 */
export function EditAddressButton({ customerId, address }: { customerId: string; address: Address }) {
  const t = useTranslations("customers.editAddress");
  const canManage = useCan("customers.manage");
  const [open, setOpen] = useState(false);
  if (!canManage) return null;
  return (
    <>
      <Button size="sm" variant="ghost" iconStart="edit" onClick={() => setOpen(true)}>
        {t("open")}
      </Button>
      {open ? <EditAddressDialog customerId={customerId} address={address} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function EditAddressDialog({
  customerId,
  address,
  onClose,
}: {
  customerId: string;
  address: Address;
  onClose: () => void;
}) {
  const t = useTranslations("customers.editAddress");
  const queryClient = useQueryClient();
  const geoName = useGeoName();
  const [values, setValues] = useState({
    label: address.label,
    recipientName: address.recipientName,
    phone: address.phone.replace(/^\+66/, "0"),
    line1: address.line1,
    line2: address.line2 ?? "",
    postcode: address.postcode,
    subdistrictId: address.subdistrict?.id ?? "",
    isDefault: address.isDefault,
  });
  const lookup = usePostcodeAreas(values.postcode);
  const areas = lookup.data ?? [];
  const area = areas.find((candidate) => candidate.subdistrict.id === values.subdistrictId) ?? null;
  const provinces = [...new Set(areas.map((candidate) => candidate.province.id))];
  const provinceId =
    area?.province.id ??
    (provinces.length === 1 ? provinces[0]! : values.postcode === address.postcode ? address.province.id : null);
  const set =
    (key: "label" | "recipientName" | "phone" | "line1" | "line2") => (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues({ ...values, [key]: event.target.value });
  return (
    <FormDialog
      size="lg"
      title={t("title", { label: address.label })}
      description={t("body")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (!values.label.trim() || !values.recipientName.trim() || !values.line1.trim())
          throw new FormError(t("incomplete"));
        if (!/^0\d{8,9}$/.test(values.phone)) throw new FormError(t("badPhone"));
        if (!/^\d{5}$/.test(values.postcode) || !provinceId) throw new FormError(t("badPostcode"));
        const { contract } = adminBrowserApis();
        const path = { customerId, addressId: address.id };
        const { response } = await contract.GET("/v1/admin/customers/{customerId}/addresses/{addressId}", {
          params: { path },
        });
        await contract.PATCH("/v1/admin/customers/{customerId}/addresses/{addressId}", {
          params: { path, header: { "If-Match": response.headers.get("ETag") ?? "" } },
          body: {
            label: values.label.trim(),
            recipientName: values.recipientName.trim(),
            phone: values.phone,
            line1: values.line1.trim(),
            line2: values.line2.trim() || null,
            postcode: values.postcode,
            provinceId,
            subdistrictId: values.subdistrictId || null,
            ...(values.isDefault !== address.isDefault ? { isDefault: values.isDefault } : {}),
          },
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.related("admin", "customer", customerId, "addresses"),
        });
        toast.success(t("done"));
        onClose();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("label")} required>
          <Input value={values.label} onChange={set("label")} />
        </Field>
        <Field label={t("recipient")} required>
          <Input value={values.recipientName} onChange={set("recipientName")} />
        </Field>
        <Field label={t("phone")} required>
          <Input inputMode="tel" value={values.phone} onChange={set("phone")} />
        </Field>
        <Field label={t("postcode")} hint={geoName(area?.province ?? areas[0]?.province) ?? undefined} required>
          <Input
            inputMode="numeric"
            maxLength={5}
            value={values.postcode}
            onChange={(event) =>
              setValues({ ...values, postcode: event.target.value.replace(/\D/g, ""), subdistrictId: "" })
            }
          />
        </Field>
        <Field label={t("line1")} required className="sm:col-span-2">
          <Input value={values.line1} onChange={set("line1")} />
        </Field>
        <Field label={t("line2")} className="sm:col-span-2">
          <Input value={values.line2} onChange={set("line2")} />
        </Field>
        {areas.length > 0 ? (
          <Field label={t("subdistrict")} className="sm:col-span-2">
            <SearchableSelect
              value={values.subdistrictId || undefined}
              onValueChange={(subdistrictId) => setValues({ ...values, subdistrictId })}
              placeholder={t("choose")}
              options={areas.map((candidate) => ({
                value: candidate.subdistrict.id,
                label: [candidate.subdistrict, candidate.district, candidate.province].map(geoName).join(" · "),
              }))}
            />
          </Field>
        ) : null}
      </div>
      <Checkbox
        label={t("isDefault")}
        checked={values.isDefault}
        disabled={address.isDefault}
        onCheckedChange={(on) => setValues({ ...values, isDefault: on === true })}
      />
    </FormDialog>
  );
}

/**
 * Adding or removing a customer's points (D-131, D-132) with a reason — a finance action, audited.
 * Added points are a new lot that expires on the usual schedule; removed points come off the oldest
 * lots first and never below zero.
 */
export function AdjustPointsButton({ customerId, available }: { customerId: string; available: number }) {
  const t = useTranslations("customers.adjustPoints");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canAdjust = useCan("loyalty.adjust");
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  if (!canAdjust) return null;
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        iconStart="star"
        onClick={() => {
          setIdempotencyKey(newIdempotencyKey());
          setOpen(true);
        }}
      >
        {t("open")}
      </Button>
      {open ? (
        <FormDialog
          title={t("title")}
          description={t("body", { available: format.number(available) })}
          submitLabel={t("submit")}
          onClose={() => setOpen(false)}
          onSubmit={async () => {
            if (!/^\d{1,7}$/.test(points) || Number(points) < 1) throw new FormError(t("badPoints"));
            if (direction === "remove" && Number(points) > available) throw new FormError(t("tooMany", { available }));
            if (reason.trim().length < 5) throw new FormError(t("needReason"));
            await adminBrowserApis().contract.POST("/v1/admin/customers/{customerId}/loyalty/adjustments", {
              params: { path: { customerId }, header: { "Idempotency-Key": idempotencyKey } },
              body: { points: direction === "add" ? Number(points) : -Number(points), reason: reason.trim() },
            });
            void queryClient.invalidateQueries({ queryKey: queryKeys.detail("admin", "customer", customerId) });
            toast.success(t(direction === "add" ? "added" : "removed", { points: format.number(Number(points)) }));
            setOpen(false);
            setPoints("");
            setReason("");
          }}
        >
          <SegmentedControl
            label={t("direction")}
            value={direction}
            onValueChange={(value) => setDirection(value as "add" | "remove")}
            options={[
              { value: "add", label: t("add") },
              { value: "remove", label: t("remove") },
            ]}
          />
          <Field label={t("points")} required>
            <NumberInput min={1} value={points} onChange={(event) => setPoints(event.target.value)} />
          </Field>
          <Field label={t("reason")} hint={t("reasonHint")} required>
            <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </FormDialog>
      ) : null}
    </>
  );
}
