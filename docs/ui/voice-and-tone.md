# Voice & tone — Thai first

> `docs/prompts/design-system.md` §8. Applies to every zone, and to the email, LINE and SMS
> copy that mirrors it.

## The voice

**Clear, polite, specific.** getpack is a production partner, not a brochure. A customer is
spending real money on a physical thing that cannot be un-printed, so copy is judged on whether
it prevents a mistake — not on how friendly it sounds.

1. **Say what happens next.** "ส่งไฟล์ให้โรงพิมพ์แล้ว — พร้อมส่ง 18 ก.ย. 2569" beats "สำเร็จ!".
2. **Name the thing.** "กล่องฝาชน (RSC)" not "สินค้า". "PK-2569-00042" not "คำสั่งซื้อของคุณ".
3. **Explain jargon inline**, once, where the decision is made: "ลูกฟูก E-flute (ลอนบาง ~1.5 มม.)".
4. **Never blame the user.** "ไฟล์ใหญ่เกิน 8 MB" not "คุณอัปโหลดไฟล์ผิด".
5. **Be honest about money and time** (design-system.md §1.3). If a price or a date changes,
   say why in the same breath.

## Thai specifics

- **ครับ/ค่ะ sparingly.** Use them in greetings and apologies, not on every line — a UI that
  says ครับ eight times reads as nervous. Never guess the reader's gender: prefer neutral
  phrasing over a wrong ค่ะ.
- **Buttons are verbs**: "บันทึก", "เริ่มออกแบบ", "ส่งออก". Never "ตกลง" where a verb exists,
  and never "คลิกที่นี่".
- **No ALL CAPS**, in either script. Thai has no case, so capitalised English beside it shouts.
- **Numbers carry separators and units**: "1,234.56 ฿", "525 × 180 มม.", "3 มม.".
- **Dates**: Buddhist era for customers ("17 ก.ย. 2569"), ISO in exports. Relative times get an
  absolute tooltip.
- **Avoid English loanwords where a plain Thai word exists** — but keep industry terms the
  factory actually uses (ไดคัท, bleed, flexo, RSC), because that is the vocabulary a print buyer
  and a factory planner share. Which is which is settled in [`glossary.md`](./glossary.md), one
  term to one translation across the UI, emails, LINE and PDFs.

## English

British spelling, sentence case, no exclamation marks in transactional copy. English is for
international customers and for exports, so it stays plainer than the Thai: same meaning, fewer
politeness particles, no idiom.

## Patterns

| Situation | Do | Don't |
|---|---|---|
| Empty state | "ยังไม่มีงานออกแบบ — เริ่มออกแบบกล่องแรกของคุณ" | "ไม่พบข้อมูล" |
| Error | "บันทึกไม่สำเร็จ — พื้นที่จัดเก็บเต็ม (ลองลดขนาดรูปภาพ)" | "เกิดข้อผิดพลาด" |
| Destructive confirm | restate the target: "“กล่องขนมปัง” จะถูกลบและไม่สามารถกู้คืนได้" | "คุณแน่ใจหรือไม่?" |
| Warning that is not an error | "ตัวอักษรเล็กกว่า 6pt อาจพิมพ์ไม่ชัด" | "คำเตือน!" |
| Success | name the outcome and the next step | "เรียบร้อย!" |

## Where copy lives

`src/i18n/messages/{th,en}/<namespace>.json`, in both languages, always. A string in a
component is a bug — the ESLint rule that enforces it arrives in F1; until then, review does.
ICU placeholders must match across locales (`src/i18n/messages.test.ts` asserts it).

## Glossary

The Thai ↔ English packaging glossary lands in F1 with the catalogue, so the storefront, the
admin queue, the factory job card and the emails use one word per concept.
