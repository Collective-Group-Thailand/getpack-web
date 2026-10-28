import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { loadAllMessages } from "@/i18n/messages";

import type { PriceStep } from "./pricing";
import { SummaryStep } from "./SummaryStep";

const priced = {
  quantity: 300,
  instant: true,
  unitPrice: "15.70",
  leadTimeDays: 5,
  earliestShipDate: "2026-11-03",
  earliestDeliveryDate: "2026-11-03",
  toleranceShortagePct: null,
  toleranceOveragePct: null,
  toleranceDimensionalMm: null,
  toleranceColourDeltaE: null,
} as unknown as PriceStep;

async function show(step: PriceStep) {
  const messages = await loadAllMessages("th");
  render(
    <NextIntlClientProvider locale="th" messages={messages}>
      <SummaryStep priced={step} pattern={null} draft={null} draftBusy={null} onDraft={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe("summary next steps (C4-API-3)", () => {
  it("names the arrival window the dock shows, not the single delivery date", async () => {
    await show({ ...priced, arrival: { from: "2026-11-06", to: "2026-11-10" } } as unknown as PriceStep);
    expect(screen.getByText(/ถึงประมาณ 6 พ\.ย\.–10 พ\.ย\.|ถึงประมาณ 6–10 พ\.ย\./)).toBeInTheDocument();
    expect(screen.queryByText(/ได้รับประมาณ/)).toBeNull();
  });

  it("falls back to the single delivery date without a window", async () => {
    await show({ ...priced, arrival: null } as unknown as PriceStep);
    expect(screen.getByText(/ได้รับประมาณ/)).toBeInTheDocument();
  });
});
