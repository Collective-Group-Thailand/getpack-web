import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { loadAllMessages } from "@/i18n/messages";

import { PreviewSide, type PreviewDimensions } from "./PreviewSide";

async function show(dimensions: PreviewDimensions | null, rows: { label: string; value: string }[] = []) {
  const messages = await loadAllMessages("th");
  render(
    <NextIntlClientProvider locale="th" messages={messages}>
      <PreviewSide title="เบอร์ 00" dimensions={dimensions} rows={rows} />
    </NextIntlClientProvider>,
  );
}

describe("the preview's side panel", () => {
  it("shows the sizes the API sent, with the thickness note only when it sent the caliper", async () => {
    await show({
      caliperMm: 3,
      sizes: {
        internal: { l: 140, w: 97.5, d: 60 },
        external: { l: 146, w: 103.5, d: 66 },
        overCrease: { l: 143, w: 100.5, d: 66 },
        product: null,
      },
    });
    expect(screen.getByText("140 × 97.5 × 60 มม.")).toBeInTheDocument();
    expect(screen.getByText("146 × 103.5 × 66 มม.")).toBeInTheDocument();
    expect(screen.getByText("143 × 100.5 × 66 มม.")).toBeInTheDocument();
    expect(screen.getByText(/ความหนาวัสดุ 3 มม./)).toBeInTheDocument();
  });

  it("leaves out a basis the API did not send, and the note when there is no caliper", async () => {
    await show({
      caliperMm: null,
      sizes: { internal: { l: 140, w: 97.5, d: 60 }, external: null, overCrease: null, product: null },
    });
    expect(screen.getByText("ภายใน")).toBeInTheDocument();
    expect(screen.queryByText("ภายนอก")).toBeNull();
    expect(screen.queryByText("ตามทับเส้น")).toBeNull();
    expect(screen.queryByText(/ความหนาวัสดุ/)).toBeNull();
  });

  it("draws no sizes before the API has answered", async () => {
    await show(null, [{ label: "วัสดุ", value: "ลอน B" }]);
    expect(screen.queryByText("ภายใน")).toBeNull();
    expect(screen.getByText("ลอน B")).toBeInTheDocument();
  });
});
