# Glossary — packaging terms, Thai ↔ English

> `docs/prompts/design-system.md` §8. One term, one translation, everywhere: the UI, the
> emails, the LINE messages, the PDFs and the partner zone. Original content written for this
> repo — no wording is taken from a competitor or from the legacy product.

## How to use it

- **Pick the Thai a print buyer and a factory planner both say.** Packaging is a trade with its
  own vocabulary, much of it borrowed English (ไดคัท, bleed, flexo). Translating those into
  invented Thai makes a screen harder to read, not more Thai. Translate the *general* words;
  keep the *trade* words (`voice-and-tone.md`).
- **Explain a term the first time a decision depends on it**, inline, not in a tooltip nobody
  opens: "ลูกฟูก E-flute (ลอนบาง ~1.5 มม.)".
- **Adding a term**: add the row here first, then the message key. If two screens need slightly
  different wording for the same thing, one of them is wrong.

## Structure & style

| Thai | English | Note |
|---|---|---|
| กล่องฝาเสียบ | Tuck-end box | Folding carton with tucked flaps; `tuck-end` in `@getpack/dieline` |
| กล่องฝาชน | Regular slotted container (RSC) | The standard corrugated shipping box |
| กล่องถาด | Tray | Open-top tray, often with a separate lid |
| กล่องฝาครอบ | Lid-and-base box | Two pieces; "rigid box" when mounted on greyboard |
| แผ่นคลี่ / ไดไลน์ | Dieline | The flat layout before folding. Say ไดไลน์ to a factory, แผ่นคลี่ to a customer |
| ไดคัท | Die-cut | Cutting to a shape with a steel rule die |
| บล็อกไดคัท | Cutting die / die block | The tool itself — a one-off charge (D-153) |
| เส้นตัด | Cut line | |
| เส้นพับ | Crease / fold line | |
| ระยะตัดตก | Bleed | Artwork past the trim edge, so a cut inside tolerance shows no white |
| พื้นที่ปลอดภัย | Safe zone | Keep text inside it |
| ลิ้นกาว | Glue flap / tab | |
| ก้นกล่องอัตโนมัติ | Auto-lock bottom | |

## Material

| Thai | English | Note |
|---|---|---|
| ลูกฟูก | Corrugated board | |
| ลอน | Flute | The wave between liners; E, B, C, EB by thickness |
| ลอน E / E-flute | E-flute | ~1.5 mm — the thin one, for retail cartons |
| ลอน B / B-flute | B-flute | ~3 mm |
| ลอน C / C-flute | C-flute | ~4 mm — shipping cartons |
| กระดาษกล่องแป้ง | Folding boxboard | |
| กระดาษอาร์ตการ์ด | Art card | Coated one or both sides |
| กระดาษคราฟท์ | Kraft paper | |
| แกรม | gsm | Grammage, g/m². Always with a number: "350 แกรม" |
| กระดาษรีไซเคิล | Recycled board | |

## Printing & finishing

| Thai | English | Note |
|---|---|---|
| ออฟเซ็ต | Offset printing | |
| เฟล็กโซ | Flexographic printing | Usual for corrugated |
| ดิจิทัล | Digital printing | Short runs, no plate charge |
| เพลท / แม่พิมพ์ | Printing plate | A one-off charge, not repeated on a reorder (D-153) |
| สีพิเศษ | Spot colour | Pantone; distinct from CMYK process |
| พิมพ์ 4 สี | Four-colour process (CMYK) | |
| เคลือบด้าน | Matt lamination | |
| เคลือบเงา | Gloss lamination | |
| สปอตยูวี | Spot UV | |
| ปั๊มฟอยล์ | Foil stamping | |
| ปั๊มนูน | Embossing | ปั๊มจม = debossing |
| หน้าต่างใส | Window patch | |

## Commerce & production

| Thai | English | Note |
|---|---|---|
| ใบเสนอราคา | Quotation | |
| ขอใบเสนอราคา | Request for quotation (RFQ) | The non-instant path (D-100) |
| ราคาทันที | Instant quote | Available where a factory price path exists (D-043) |
| จำนวนสั่งขั้นต่ำ | Minimum order quantity (MOQ) | |
| ราคาต่อชิ้น | Unit price | |
| ขั้นราคา | Price break | Quantity tiers |
| ค่าเริ่มงาน | Setup charge | |
| ตรวจแบบก่อนพิมพ์ | Proof check (the step) | Customer-facing name of the step (Phase 4) |
| แบบตัวอย่าง | Proof (the file) | Customer-facing: "ส่งแบบตัวอย่างให้ดู", "อนุมัติแบบตัวอย่าง v2", "ไฟล์และแบบตัวอย่าง". Digital unless a physical one is bought (D-072) |
| Proof | Proof | System status, admin, partner and page names, in English with spaces around it: "รอ Proof", "Proof อนุมัติแล้ว", "ไฟล์งานและ Proof", page "Proof review" |
| ตัวอย่างจริง | Physical proof / mockup | A paid add-on |
| อาร์ตเวิร์ก | Artwork | The customer's print-ready file |
| พรีเฟลท | Preflight | The automatic file check (D-070) |
| ระยะเวลาผลิต | Lead time | In business days; the API computes it |
| โรงงานพาร์ตเนอร์ | Partner factory | Never "supplier" to a customer |
| ความคลาดเคลื่อนจำนวน | Quantity tolerance | Over/under-run allowance (D-021, D-080) |
| หลักฐานการส่งมอบ | Proof of delivery (POD) | Required on every delivery (D-013) |
| เคลม | Claim | Within 7 days of receipt (D-082) |
| สั่งซ้ำ | Reorder | Same spec and artwork, re-priced (D-153) |

## Terms to avoid

| Do not use | Use instead | Why |
|---|---|---|
| Locopack | — | The legacy system; it never appears in the product (D-001) |
| ต้นทุนโรงงาน | ราคาซื้อ / price list | getpack never asks a factory for its internal cost (D-042) |
| ซัพพลายเออร์ (to a customer) | โรงงานพาร์ตเนอร์ | getpack is the seller; the factory relationship is not the customer's (D-010) |
| สินค้า (for a box) | the box style by name | "Name the thing" (`voice-and-tone.md`) |
| คลิกที่นี่ | the verb for the action | |
| ปรู๊ฟ, ตัวอย่างงานพิมพ์, พิสูจน์อักษร | แบบตัวอย่าง / ตรวจแบบก่อนพิมพ์ for customers; Proof for statuses, the back office, the factory app and page names | Phase 4 §4.5. Zero in UI copy, i18n and the display mapping (CI: `src/ui/design-language.test.ts`); API text is mapped at display (`src/i18n/terms.ts`) until getpack-api adopts this glossary |
