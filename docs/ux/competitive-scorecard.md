# Competitive UX scorecard — proving "better", not claiming it

> "Better than the competitor" is a release gate measured with real users, not an opinion. The same tasks are run on the competitor (baseline, now) and on getpack (before launch and every quarter). Results live in `docs/ux/scorecard-results/<date>.md`.

## 1. Participants and method
- 8–10 participants per round from the target segments: Thai SME owners (food, cosmetics, e-commerce), a procurement officer at a mid-size company, a freelance graphic designer. At least 3 of them on a mid-range Android phone.
- Moderated remote sessions (think-aloud, recorded with consent under PDPA), same task order randomised per participant, same instructions in Thai.
- On the competitor: participants stop **before** any submission, payment or message to a factory — no fake requests are sent.
- Metrics per task: completion (yes/partial/no), time on task, number of steps (screens + decisions), errors, Single Ease Question (1–7). Per session: SUS (System Usability Scale). Qualitative: top 3 frustrations.

## 2. Benchmark tasks
| # | Task (instruction given to the participant) | Journey | getpack step budget |
|---|---|---|---|
| T1 | "หากล่องไปรษณีย์สำหรับสินค้าขนาด 20×15×8 ซม. หนัก 500 กรัม แล้วดูว่า 500 ใบราคาเท่าไร" | discovery → price | ≤ 4 steps to a real price |
| T2 | "ใส่โลโก้ของคุณบนกล่องนี้ที่ด้านบนและด้านหน้า แล้วดูภาพ 3D" | studio | ≤ 6 steps |
| T3 | "ทำให้ไฟล์พร้อมพิมพ์ (แก้ทุกปัญหาที่ระบบแจ้ง)" | checks | 0 unexplained warnings |
| T4 | "สั่งผลิต 1,000 ใบ ส่งมาที่บริษัท" (stop at payment) | order | ≤ 5 steps from studio |
| T5 | "ขอตัวอย่างก่อนสั่งผลิตจริง" | sample | ≤ 4 steps |
| T6 | "งบของคุณคือ 8 บาท/ใบ — ทำให้ได้ราคาใกล้เคียงที่สุด" | target price | participant finds a lever unaided |
| T7 | "ตอนนี้งานของคุณอยู่ขั้นไหน และจะได้ของวันไหน" (seeded order) | tracking | ≤ 2 steps from LINE notification |
| T8 | "สั่งซ้ำงานเดิม 2,000 ใบ" | reorder | ≤ 3 steps |
| T9 | "สินค้าที่ได้รับสีเพี้ยน — แจ้งปัญหา" (seeded delivered order) | claim | ≤ 5 steps |
| T10 | "ขอใบกำกับภาษีของออร์เดอร์นี้" | documents | ≤ 2 steps |
| T11 (partner) | "รับงานใหม่ แล้วอัปเดตว่าเริ่มพิมพ์พร้อมถ่ายรูป" | partner job | ≤ 4 taps, one hand |
| T12 (designer) | "ดาวน์โหลดไฟล์ไดไลน์ขนาดนี้ไปทำใน Illustrator" | dieline | ≤ 3 steps, file opens with named layers |

Tasks the competitor cannot perform (e.g. T1 real price, T4 instant order) are recorded as "not possible" — that is a win only if our completion on them is ≥ 90 %.

## 3. Release gate (getpack vs competitor baseline)
| Measure | Gate |
|---|---|
| Completion rate, all tasks | ≥ 90 % on getpack |
| Median time on comparable tasks (T2, T5, T7, T9) | ≥ 30 % faster than baseline |
| Steps | within the step budget for every task |
| SEQ | ≥ 6.0 median on every task |
| SUS | ≥ 80 (baseline recorded for comparison) |
| Mobile | no task more than 20 % slower on the Android device than on desktop |
| Accessibility | one screen-reader participant completes T1, T4, T7 |
Any failed gate blocks launch of the affected journey and creates a fix ticket with the session evidence.

## 4. Automated guardrails between rounds
- Playwright "step counters" for T1–T12 on our side: fail CI when a journey exceeds its step budget or a required field is added without a scorecard update.
- Funnel dashboards (studio start → add to cart, configurator → quote → cart, claim start → submit) with alerts on drops > 15 % week over week.
- Session replay with PII masking on key journeys (consent-based) to find rage clicks and dead ends.

## 5. Known exceptions to the step budgets
A journey that a business decision or an API rule keeps over its §2 budget is listed here with the count it has today as its **ceiling**. The step counters are blocking in CI since U5.8 (`STEP_BUDGETS=enforce`): a journey fails when it is over budget without an exception, above its ceiling, or back within budget while still listed here (remove the row). An exception never changes the budget, and is reviewed at the first scorecard round after launch, when a failed gate starts blocking the journey (D-217). `e2e/journeys/budgets.ts` (`EXCEPTIONS`) is the machine-readable copy; a unit test fails when the two disagree.

| Task | Ceiling | Cause | Owner of the cause |
|---|---|---|---|
| T1 | 5 steps | Homepage v10 (Studio-first): the hero prices its three standard sizes, so a size of the customer's own is typed in the configurator — one more choice, then D-182's measurement basis | Product owner (homepage v10) · Pricing owner (D-182) |
| T5 | 6 steps | D-182: the customer must choose the measurement basis before a price (no silent default); the product opens on its standard sizes, so a size of the customer's own is one more choice | Pricing owner (D-182) |
| T9 | 7 steps | D-082: a carton photo is required with every claim (store.claims.getForm cartonPhotosMin); D-198: the customer chooses the remedy | CS Lead (D-082 per claim type) · getpack-api |
| T11 | 6 taps | getpack-api: factory steps run strictly in order and a photo is taken only when a step finishes | Partner Manager · getpack-api |
| T12 | 7 steps | D-203 / D-271: the free dieline needs a signed-in customer (2 steps); reaching a style from the home page takes 2 screens — a dieline entry without the library is open | Marketing (D-203) · getpack-web (dieline entry) |
