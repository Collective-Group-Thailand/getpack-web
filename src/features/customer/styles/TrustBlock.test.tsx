import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import th from "@/i18n/messages/th/customer/styles.json";

import { hasTrust, TrustBlock } from "./TrustBlock";

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async (namespace: string) =>
      createTranslator({ locale: "th", messages: { styles: th }, namespace: namespace as never }),
  };
});

const empty = { certifications: [], foodGrade: [], productionPhotos: [], customerLogos: [], taxInvoiceNote: null };

describe("the trust section (C0)", () => {
  it("shows only the decision-backed tax-invoice note when staff entered nothing (C0b: D-010, D-125)", async () => {
    expect(hasTrust(empty)).toBe(false);
    expect(hasTrust(null)).toBe(false);
    for (const trust of [empty, null]) {
      const { unmount } = render((await TrustBlock({ trust, locale: "th" }))!);
      expect(screen.getByText("ใบกำกับภาษีเต็มรูปแบบ")).toBeInTheDocument();
      expect(screen.getByText(th.library.trustTaxInvoiceDefault)).toBeInTheDocument();
      expect(screen.queryByText("ใบรับรองวัสดุ")).toBeNull();
      expect(screen.queryByText("รูปงานจริงระหว่างผลิต")).toBeNull();
      expect(document.body.textContent).not.toMatch(/โรงงาน/);
      unmount();
    }
  });

  it("shows only the parts that have content, with the production-photo label of GLOBAL-RULES §1", async () => {
    render(
      (await TrustBlock({
        trust: {
          ...empty,
          certifications: [
            { title: { th: "ใบรับรอง A", en: null }, number: "N-1", issuer: "ผู้ออก B", expiresOn: null, documentUrl: null },
          ],
          productionPhotos: [{ url: "https://files.example/p.webp", alt: { th: "งานพิมพ์", en: null } }],
        },
        locale: "th",
      }))!,
    );
    expect(screen.getByRole("heading", { name: "ความน่าเชื่อถือ" })).toBeInTheDocument();
    expect(screen.getByText("ใบรับรองวัสดุ")).toBeInTheDocument();
    expect(screen.getByText("รูปงานจริงระหว่างผลิต")).toBeInTheDocument();
    expect(document.body.textContent).toContain("ออกโดย ผู้ออก B");
    expect(screen.queryByText("วัสดุสัมผัสอาหาร")).toBeNull();
    expect(screen.queryByText("แบรนด์ที่ไว้วางใจ")).toBeNull();
    expect(document.body.textContent).not.toMatch(/โรงงาน/);
  });
});
