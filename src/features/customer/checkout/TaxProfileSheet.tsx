"use client";

import { useTranslations } from "next-intl";

import { Sheet } from "@/ui/components/Sheet";

import { TaxProfileForm, type TaxProfile } from "../account/TaxProfileForm";

/** A new tax-invoice profile without leaving the checkout. Loaded on first use. */
export function TaxProfileSheet({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (profile: TaxProfile) => void;
}) {
  const t = useTranslations("account.taxForm");
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("newTitle")} closeLabel={t("cancel")}>
      <TaxProfileForm onSaved={onSaved} onCancel={() => onOpenChange(false)} />
    </Sheet>
  );
}
