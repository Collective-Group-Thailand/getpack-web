"use client";

import { useState, useSyncExternalStore } from "react";

import { readVatPreference, writeVatPreference } from "@/features/shared/format/vat-preference";
import { Switch } from "@/ui/components/Switch";

/**
 * "ราคารวม VAT" (ruling C1): on = the API's VAT-inclusive figure, off = its VAT-exclusive one. The
 * page draws it only when the API supplied both figures for the prices shown
 * (`vatSwitchAvailable`); today it supplies the inclusive one only, so this is not rendered. The
 * choice is remembered per browser by the shared preference store.
 */
export function VatSwitch({ label, onChange }: { label: string; onChange?: (inclusive: boolean) => void }) {
  const stored = useSyncExternalStore(
    () => () => {},
    () => readVatPreference() === "incl",
    () => true,
  );
  const [chosen, setInclusive] = useState<boolean | null>(null);
  const inclusive = chosen ?? stored;
  return (
    <Switch
      label={label}
      labelPosition="start"
      checked={inclusive}
      onCheckedChange={(next) => {
        setInclusive(next);
        writeVatPreference(next ? "incl" : "excl");
        onChange?.(next);
      }}
    />
  );
}
