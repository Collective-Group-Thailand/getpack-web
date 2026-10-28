import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import th from "@/i18n/messages/th/customer/styles.json";

import { wizardSummary } from "./wizard-labels";

const t = createTranslator({ locale: "th", messages: { styles: th }, namespace: "styles" }) as unknown as (
  key: string,
) => string;

describe("the wizard's chip words (C0)", () => {
  it("names the answers in the order asked, with the real use-case labels", () => {
    expect(wizardSummary({ items: ["food", "snack"], place: ["ship"] }, t)).toBe(
      "อาหาร · ขนมและเบเกอรี่ · ส่งพัสดุ / ขายออนไลน์",
    );
    expect(wizardSummary({ items: ["*"], place: [] }, t)).toBe("สินค้าทั่วไป");
  });
});
