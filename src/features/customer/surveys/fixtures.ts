/**
 * A survey instance for stories and tests (Thai), the shape of API-CHANGES-P2 `store.surveys.next`. No MSW import, so a
 * story can load it in the browser bundle.
 */

import type { SurveyInstance } from "@/lib/api/requests/store-loyalty-p2";

export const SURVEY_FIXTURE: SurveyInstance = {
  id: "0192f3a0-7c1e-7d2a-9b1f-0000000d0001",
  trigger: "post_delivery",
  orderCode: "OR-2610-0042",
  status: "open",
  expiresAt: "2026-12-04T08:00:00+07:00",
  rewardPoints: 8,
  title: "คำสั่งซื้อล่าสุดเป็นอย่างไรบ้าง",
  questions: [
    { key: "overall", kind: "rating", label: "ความพึงพอใจโดยรวม", min: 1, max: 5, required: true },
    {
      key: "quality",
      kind: "single",
      label: "คุณภาพงานพิมพ์ตรงกับที่คาดไหม",
      options: [
        { key: "better", label: "ดีกว่าที่คาด" },
        { key: "as_expected", label: "ตรงตามที่คาด" },
        { key: "worse", label: "ต่ำกว่าที่คาด" },
      ],
      required: true,
    },
    {
      key: "improve",
      kind: "multi",
      label: "อยากให้เราปรับปรุงเรื่องใด",
      options: [
        { key: "lead_time", label: "ระยะเวลาผลิต" },
        { key: "price", label: "ราคา" },
        { key: "design", label: "การออกแบบ" },
      ],
      required: false,
    },
    { key: "comment", kind: "text", label: "อยากบอกอะไรเพิ่มเติม", maxLength: 500, required: false },
  ],
};
