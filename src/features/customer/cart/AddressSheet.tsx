"use client";

import { useTranslations } from "next-intl";

import { Sheet } from "@/ui/components/Sheet";

import { AddressForm, type Address } from "../account/AddressForm";

/** A new address without leaving the cart or the checkout. Loaded on first use. */
export function AddressSheet({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (address: Address) => void;
}) {
  const t = useTranslations("account.addressForm");
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("newTitle")} closeLabel={t("cancel")}>
      <AddressForm onSaved={onSaved} onCancel={() => onOpenChange(false)} />
    </Sheet>
  );
}
