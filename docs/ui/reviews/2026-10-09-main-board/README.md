# `/` and `/studio` at 1440 against the boards — 2026-10-09

Boards: `docs/ui/boards/getpack-home-board-Main-1440.png`, `docs/ui/boards/getpack-board-StudioStart-1440.png`.

Taken on `fix/home-review-main` @ the v0.43.2 adoption, `next dev` on :3700 against **getpack-api v0.43.2** (:3000, local
main `38c385d`) on `getpack_uat_partner` as reseeded from that main. Photos: the dev-only local manifest fallback
(`HOME_PHOTOS_LOCAL_MANIFEST`, D-314 interim photos), since the API's fake storage holds no CMS photos. `/` is anonymous;
`/studio` is the UAT customer มาลี ทดสอบ (0800000101, OTP). Next's dev overlay is hidden. (A first set on v0.43.1 showed
the same pages.)

## Confirmed on v0.43.2

- The hero opens on the API's `default`: ไปรษณีย์ · 18 × 12 × 5 ซม. · ลูกฟูก E · 1 สี · 500 ชิ้น, priced by
  `POST /v1/store/quotes/actions/preview` at **฿20.14** a piece (total ฿10,070.00, 5 working days, `presetId` `mailer:s0`).
- The lid (`uat-fruit-box-tele`, PK-CT-02) prices **฿28.74** a piece at 500 in the hero and in `/configure`: both send
  the same two parts (body and lid), each printed outside only. `e2e/integration/home-hero.spec.ts`: mailer and lid
  pass, tuck skipped (folding is RFQ in UAT).
- FAQs: 11 in 4 groups, none with a decision id or `[DEV]`, at the API and on the page.

| File | What |
|---|---|
| `home-1440.png`, `studio-1440.png` | the pages as rendered (home full page, studio first screen 1440 × 1150) |
| `home-vs-board-1440.jpg`, `studio-vs-board-1440.jpg` | board left, page right, same scale |

## Matches the board

- Header: five links in the board's order. Hero: the title, the copy, the two calls to action, and the Studio panel
  with the board's rows (shape, size, board, print, quantity), a price per piece with its total, the lead time, the lock,
  "ออกแบบต่อ" and the link to `/configure`. The panel's price is the real one: mailer 18 × 12 × 5, ลูกฟูก E, 1 สี,
  500 pcs = ฿20.14 (`store.quotes.preview`). The hero and `/configure` agree on mailer and lid (real-API parity e2e).
- Trust row, photo mosaic, "screen to factory" (four day cards), "what the studio checks" (three cards), the dark sage
  band with its two cards, "what we make", FAQ, contact and newsletter, footer.
- `/studio`: the title, the intro and the help line, the four starting cards with their copy and links, and "แบบล่าสุดของคุณ".

## Differs from the board — data, not layout

The web renders what the API returns and leaves out what has no source (D-307, D-309). On this UAT data:

| Board | Page | Why |
|---|---|---|
| Template gallery "ไม่ต้องเริ่มจากศูนย์" (home), "แบบที่คนเริ่มบ่อย" (studio) | absent | `store.styles.list` has **0 published styles** (`publicConfig.templateCount` 0); the 105 imported bases are not published (prepress). |
| Hero facts "40+ แบบกล่อง · 1 วัน ตรวจแบบ · 300 ชิ้น ขั้นต่ำ" | "ตรวจแบบ โดยทีมปรีเพรสทุกงาน · 100 ชิ้น ขั้นต่ำ" | template count 0; `proofSlaBusinessDays` unset (Prepress); `minOrderQty.custom` = 100 (D-309: the lowest made-to-order minimum in this catalogue). |
| Shape chip "ฝาเสียบ" | absent | the tuck product is folding, RFQ in UAT (getpack-api A-16, pricing owner). |
| Board chips "คราฟท์ 350g", "อาร์ตการ์ด 350g" active, kraft default, ฿7.85 | disabled; default ลูกฟูก E; ฿20.14 | the UAT hero products are corrugated and publish E-flute only; the board's figures are illustrative. |
| "ส่งถึงมือประมาณ 7–10 วันทำการ · ล็อกราคา 14 วัน" | "ผลิตประมาณ 5 วันทำการ · ล็อกราคาถึง 24 ต.ค. 2569" | the preview's production range and `priceLockUntil` (D-051 = 15 days); delivery is not in the preview. |
| Customer stories "แบรนด์เล็กที่อยากดูเป็นแบรนด์ใหญ่" | absent | D-311: shown only with 3 approved stories; none in UAT. |
| Contact "คุยทาง LINE · โทร 02-xxx-xxxx" | "คุยกับทีม", no phone | `storefront.support_channels` / `publicConfig.contact` unset (CS Lead). |
| `/studio` recent designs (3 rows) | empty state | มาลี has no studio designs in the UAT seed. |

## Differs from the board — the page's own

- Header: the board has "สตูดิโอ" beside the logo, "ตะกร้า 2" as text and no call to action; the page has search, the
  cart icon, the language switch and "เริ่มออกแบบฟรี" (the U-F3 header). The board's logo glyph is not the getpack mark.
- Studio panel: the board has a "3D · แผ่นคลี่" toggle in the panel; the page draws the box only (the full studio has both).
- `/studio` cards: the first card's dieline matches; the other three are the page's own icons (a box, a checked
  document, a list) where the board draws a measured box, an upload with its formats and order-number chips.
- Footer: the page's footer has five columns and the payment line; the board's has four.

## Found on the way

- **Fixed** (`fix/hero-configure-parity`): `/configure` opened from the hero kept the catalogue's default inside ink, so
  the lid priced ฿31.52 where the hero said ฿28.74. It now starts from the hero's choices only.
- **Open**: the sign-in page's consent step puts a `<details>` ("อ่านฉบับเต็ม") inside a `<p>`, a hydration error
  React reports in dev ("6 Issues") — not fixed here.
