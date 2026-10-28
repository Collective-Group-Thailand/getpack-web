"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { NumberInput } from "@/ui/components/Input";
import { Icon } from "@/ui/icons";

import { geoName, type Address } from "../account/address";
import type { CartItem as Item } from "./cart";

/** A line's quantity split across addresses (D-110) — edited here, checked by the API. */
export function Destinations({
  item,
  addresses,
  onSave,
  saving,
  onAddAddress,
}: {
  item: Item;
  addresses: Address[];
  onSave: (rows: { addressId: string; quantity: number }[]) => void;
  saving: boolean;
  onAddAddress: () => void;
}) {
  const t = useTranslations("cart.destinations");
  const locale = useLocale();
  const format = useFormat();
  // A fresh line has no destination yet: start with one row for the whole quantity, open, so a
  // first-time buyer is asked for an address right here instead of finding the pay button dim
  // with "ระบุที่อยู่จัดส่ง" and no way to do it (customer walkthrough 2026-10-16).
  const [rows, setRows] = useState(() =>
    item.destinations.length > 0
      ? item.destinations.map((destination) => ({
          addressId: destination.addressId ?? "",
          quantity: String(destination.quantity),
        }))
      : [{ addressId: "", quantity: String(item.quantity) }],
  );
  const incomplete = item.destinations.length === 0 || item.destinations.some((destination) => !destination.addressId);
  const [editing, setEditing] = useState(incomplete);
  const total = rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);

  if (!editing) {
    return (
      <div className="flex flex-col gap-1 text-sm">
        {incomplete ? (
          <p className="text-warning flex items-center gap-2 font-medium">
            <Icon name="warning" size={16} aria-hidden="true" />
            {t("choosePrompt")}
          </p>
        ) : null}
        <ul className="flex flex-col gap-1">
          {item.destinations.map((destination) => (
            <li key={destination.id} className="flex items-start gap-2">
              <Icon name="map-pin" size={16} aria-hidden="true" className="text-muted mt-0.5" />
              <span>
                {t("line", {
                  quantity: format.number(destination.quantity),
                  name: destination.address.recipientName,
                  province: destination.address.provinceNameTh,
                })}
              </span>
            </li>
          ))}
        </ul>
        <Button
          size="sm"
          variant={incomplete ? "primary" : "link"}
          className={incomplete ? "self-start" : "self-start px-0"}
          onClick={() => setEditing(true)}
        >
          {incomplete ? t("chooseAction") : item.destinations.length > 1 ? t("edit") : t("split")}
        </Button>
      </div>
    );
  }

  return (
    <fieldset className="bg-surface border-border flex flex-col gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">
        {t(rows.length > 1 ? "legend" : "legendOne", { quantity: format.number(item.quantity) })}
      </legend>
      {addresses.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-muted text-sm">{t("noAddresses")}</p>
          <Button size="sm" iconStart="map-pin" onClick={onAddAddress}>
            {t("newAddress")}
          </Button>
        </div>
      ) : null}
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-end gap-2">
          <Field label={t("address", { index: index + 1 })} className="min-w-48 flex-1">
            <SearchableSelect
              value={row.addressId || undefined}
              placeholder={t("choose")}
              onValueChange={(addressId) =>
                setRows((current) => current.map((entry, at) => (at === index ? { ...entry, addressId } : entry)))
              }
              options={addresses.map((address) => ({
                value: address.id,
                label: `${address.label} — ${address.recipientName}, ${geoName(locale, address.province)} ${address.postcode}`,
              }))}
            />
          </Field>
          <Field label={t("quantity")} className="w-32">
            <NumberInput
              min={1}
              value={row.quantity}
              onChange={(event) =>
                setRows((current) =>
                  current.map((entry, at) => (at === index ? { ...entry, quantity: event.target.value } : entry)),
                )
              }
            />
          </Field>
          {rows.length > 1 ? (
            <IconButton
              name="trash"
              variant="ghost"
              label={t("remove", { index: index + 1 })}
              onClick={() => setRows((current) => current.filter((_, at) => at !== index))}
            />
          ) : null}
        </div>
      ))}
      <p
        className={
          total === item.quantity
            ? "text-primary flex items-center gap-1 text-[13.5px] font-semibold tabular-nums"
            : "text-instant-subtle-fg text-[13.5px] font-semibold tabular-nums"
        }
        aria-live="polite"
      >
        {t("total", { total: format.number(total), quantity: format.number(item.quantity) })}
        {total === item.quantity ? <Icon name="check" size={14} aria-hidden="true" /> : null}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          iconStart="plus"
          onClick={() => setRows((current) => [...current, { addressId: "", quantity: "" }])}
        >
          {t("addRow")}
        </Button>
        {addresses.length > 0 ? (
          <Button size="sm" variant="ghost" iconStart="map-pin" onClick={onAddAddress}>
            {t("newAddress")}
          </Button>
        ) : null}
        <Button
          size="sm"
          loading={saving}
          disabled={total !== item.quantity || rows.some((row) => !row.addressId)}
          onClick={() => {
            onSave(rows.map((row) => ({ addressId: row.addressId, quantity: Number(row.quantity) })));
            setEditing(false);
          }}
        >
          {t(rows.length > 1 ? "save" : "saveOne")}
        </Button>
      </div>
    </fieldset>
  );
}
