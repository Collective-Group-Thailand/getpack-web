"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { readVatPreference, writeVatPreference } from "@/features/shared/format/vat-preference";
import type { VatBasis } from "@/features/shared/format/price";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

/** Shows the chosen basis on every price of the page (`data-vat-figure`, base.css). */
function apply(basis: VatBasis) {
  if (basis === "excl") document.documentElement.dataset.vatBasis = "excl";
  else delete document.documentElement.dataset.vatBasis;
}

/**
 * "ราคารวม VAT / ไม่รวม VAT" on the products hub (owner decision D-447, DECISIONS-STAGE-A §10.6): VAT-inclusive by
 * default; the other choice shows the API's own ex-VAT figure of each price — nothing is computed here. Remembered per
 * browser (the shared preference). Drawn only when the API sent both figures for every price shown
 * (`vatSwitchAvailable`); leaving the page resets the root to inclusive.
 */
export function HubVatSwitch({ label, incl, excl }: { label: string; incl: string; excl: string }) {
  // The stored choice after hydration (the server's page is inclusive); a press overrides it for this view.
  const stored = useSyncExternalStore(
    () => () => {},
    readVatPreference,
    () => "incl" as VatBasis,
  );
  const [chosen, setChosen] = useState<VatBasis | null>(null);
  const basis = chosen ?? stored;
  useEffect(() => {
    apply(basis);
  }, [basis]);
  useEffect(() => () => apply("incl"), []);
  return (
    <SegmentedControl<VatBasis>
      label={label}
      size="sm"
      value={basis}
      onValueChange={(next) => {
        setChosen(next);
        writeVatPreference(next);
      }}
      options={[
        { value: "incl", label: incl },
        { value: "excl", label: excl },
      ]}
    />
  );
}
