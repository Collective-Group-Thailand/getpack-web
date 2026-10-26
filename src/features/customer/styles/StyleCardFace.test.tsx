import { createTranslator } from "next-intl";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { StyleCard } from "@/features/customer/catalog/api.server";
import th from "@/i18n/messages/th/customer/styles.json";

import { cardWords, StyleCardFace } from "./StyleCardFace";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const t = createTranslator({ locale: "th", messages: { styles: th }, namespace: "styles" }) as unknown as Parameters<
  typeof cardWords
>[2];
const format = { thb: (a: string) => `฿${a}`, number: (n: number) => String(n) };

const base = {
  code: "PK-A-001",
  nameTh: "กล่องฝาครอบ",
  nameEn: "Lid box",
  category: "rigid",
  family: "specialty",
  materialClass: "rigid",
  pricePath: "rfq",
  variantCount: 18,
  featured: false,
  options: ["tuck_bottom:crash_lock", "window:front_window", "hang:euro_slot"],
  photo: null,
  thumbnailUrl: null,
  referenceCode: null,
  startingPrice: null,
  favourite: null,
} as unknown as StyleCard;

const face = (style: StyleCard) => render(<StyleCardFace style={style} words={cardWords(style, "th", t, format)} />);

describe("a style card", () => {
  it("quote style: the quote call to action, no instant badge, no estimate, no spec row", () => {
    face(base);
    expect(screen.getByText("ขอใบเสนอราคา")).toBeInTheDocument();
    expect(screen.queryByText("ราคาทันที")).toBeNull();
    expect(screen.queryByText(/ประมาณ/)).toBeNull();
    expect(document.querySelector("[data-card-specs]")).toBeNull();
    expect(screen.getByText("18 ตัวเลือก")).toBeInTheDocument();
    expect(screen.getByText("PK-A-001")).toBeInTheDocument();
  });

  it("instant style with a starting price: badge, 'เริ่มต้น ฿x/ใบ' and the VAT label", () => {
    const instant = {
      ...base,
      pricePath: "instant",
      startingPrice: { unitPrice: "4.85", quantity: 1000, currency: "THB", catalogProductSlug: "x" },
    } as unknown as StyleCard;
    const { container } = face(instant);
    expect(screen.getByText("ราคาทันที")).toBeInTheDocument();
    expect(screen.getByText("เริ่มต้น")).toBeInTheDocument();
    expect(screen.getByText("฿4.85/ใบ")).toBeInTheDocument();
    expect(container.textContent).toContain("รวม VAT");
    expect(screen.queryByText("ขอใบเสนอราคา")).toBeNull();
  });

  it("instant style without a hint falls back to the quote call to action, never an estimate", () => {
    face({ ...base, pricePath: "instant" } as StyleCard);
    expect(screen.getByText("ขอใบเสนอราคา")).toBeInTheDocument();
  });

  it("shows at most two option tags and '+n' for the rest, and one tag plus '+n' on phones", () => {
    const { container } = face(base);
    const tags = [...container.querySelectorAll("ul[aria-label] li")];
    const hiddenOnPhone = (li: Element) => /(^|\s)max-sm:hidden/.test(li.className);
    const phoneOnly = (li: Element) => /(^|\s)sm:hidden/.test(li.className);
    const wide = tags.filter((li) => !phoneOnly(li));
    const phone = tags.filter((li) => !hiddenOnPhone(li));
    expect(wide.length).toBeLessThanOrEqual(3); // two tags + "+n"
    expect(phone.length).toBeLessThanOrEqual(2); // one tag + "+n"
    expect(phone.at(-1)?.textContent).toMatch(/\+\d/);
  });

  it("draws the spec row only for the facts it is given, each hidden when missing", () => {
    const words = {
      ...cardWords(base, "th", t, format),
      specs: [{ icon: "clock" as const, text: "ผลิต 5–10 วัน" }],
    };
    render(<StyleCardFace style={base} words={words} />);
    const row = document.querySelector("[data-card-specs]") as HTMLElement;
    expect(within(row).getAllByRole("listitem")).toHaveLength(1);
    expect(row.textContent).toContain("ผลิต 5–10 วัน");
  });
});
