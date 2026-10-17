# Customer zone — UX & journey programme

Asked for by the product owner on 2026-10-16 ("สวมบทบาทว่าคือลูกค้าจริงๆ มาใช้งานระบบนี้ ถ้าดูแล้วงงตรงจุดไหน ปรับปรุงให้ดีขึ้นได้เลย", and
"เอา concept การแก้ที่ partner portal มาแก้ไขที่ customer portal ด้วย"): the partner programme's method
(`docs/ux-partner-journeys.md`) applied to every customer menu — the storefront, the account portal and the company
pages. Decisions are delegated; API-side changes are recorded in getpack-api `docs/decisions.md`.

How a journey is walked: as the customer who lives in it — a first-time buyer with nothing saved, UAT customers with
orders in flight (`0800000101` – `0800000113`, OTP `000000` on a fake stack), the company admin — on a 1280 px screen
and a 390 px phone, against the UAT database; do the job end to end (buy, pay, send artwork, approve the proof, ask for
a price); note what blocks, confuses, is missing or is out of place; fix it; walk it again. A finding is written as the
customer would say it.

| Round | Journey | Status |
|---|---|---|
| 0 | The account portal, menu by menu (lists as tables, phone nav, order page, words) | **done** (`feat/customer-portal-ux`, PROGRESS 2026-10-16) |
| 1 | Buying: home → product → configure → cart → sign in → checkout → pay → order placed | **done** below |
| 2 | After buying: artwork → proof → tracking → delivery → review / claim → reorder | below |
| 3 | Asking for a price: RFQ → quotation → accept → order; saved quotations, samples, call-offs | below |
| 4 | The account: addresses and tax profile, points, credit, referral, notifications, privacy | below |
| 5 | The company: sign-up, members, approvals, credit, bulk reorder, settings | below |
| 6 | The storefront's content: styles, materials, learn, help, FAQ, search, tracking, about | below |

## Round 1 — buying

**Walked as** a first-time buyer with nothing saved: home → สินค้าและราคา → กล่องไปรษณีย์ ฝาชน 3 ชั้น → ปรับแต่งและดูราคา
→ 300 pieces → เพิ่มลงตะกร้า → ตะกร้า → ดำเนินการชำระเงิน → OTP sign-in → consent → "บอกเราเพิ่มอีกนิด" → cart → checkout
→ ยืนยันและชำระ.

What reads well: the product page's price box (starting price, lead time, minimum, guarantee), the configurator's
live price table with "เลือกอยู่", the cart toast with "ดูตะกร้า", the five checkout steps with the summary beside them.

| # | Finding (as the customer) | Fix |
|---|---|---|
| 1.1 | Signed in with a box in the cart, the pay button is dim: "ระบุที่อยู่จัดส่งให้ครบตามจำนวน". Under "จัดส่งไปที่" there is nothing but "แบ่งส่งหลายที่อยู่". I have no address yet and nothing here lets me add one — a dead end on the first purchase. | A fresh line opens its destination editor with one row for the whole quantity: "ส่ง 300 ไปที่", the address picker, and — when the address book is empty — "เพิ่มที่อยู่ใหม่" as the main button. Collapsed, a line without an address shows "ยังไม่ได้เลือกที่อยู่จัดส่ง" with a primary "เลือกที่อยู่จัดส่ง"; one address saves with "ใช้ที่อยู่นี้", a split with "บันทึกการแบ่งส่ง". |
| 1.2 | Checkout warns at the top "ตะกร้ายังมีรายการที่ต้องแก้ไข กลับไปตรวจสอบที่ตะกร้าก่อน" — yet step 1 right under it lets me pick or add the address, and once I do, the pay button lights up while the warning stays. | The warning names only what checkout cannot fix itself — a line whose price expired ("มีรายการที่ราคาหมดอายุและต้องยืนยันราคาใหม่"); addresses are checkout's own step 1. |
| 1.3 | The summary lists "ค่าจัดส่งเพิ่มเติม ฿150" — extra to what? The product page said the price excludes delivery, so this is simply the delivery charge. | "ค่าจัดส่ง". |
| 1.4 | สินค้าและราคา lists forty products in catalogue order: the ones I can buy now are mixed with "ขอใบเสนอราคา" ones and with services (die-cutting, a sample run) that are not boxes at all. The category tile says "1 ประเภท" — one of one. | Cards are ordered instant price → quotation → services (`orderCards`), so what can be bought today comes first; a tile with a single type does not count it. |
| 1.5 | On the payment page I chose PromptPay, the QR is up — but I am on my laptop and the banking app is on my phone. Can I come back? Nothing says. | A line under the QR: pay later from คำสั่งซื้อของฉัน, and when the QR expires. |
| 1.6 | Transfer: the account number is there, but which bank? "scb_savings" is a code, not a bank. | "ธนาคารไทยพาณิชย์ · ออมทรัพย์" above the number, from a dictionary of Thai banks and account types. |
| 1.7 | On the phone the sign-in page's two corners — "กลับหน้าแรก" and "ยังไม่มีบัญชี? ใช้เบอร์มือถือสมัครได้ในขั้นเดียวกัน" — print over each other. | One row sharing the width; the note wraps on the right. |

What could not be walked here: the slip upload and the QR settlement — the sandbox's S3 and PromptPay are fakes
that never answer. Both paths are covered by the API's tests.

## Round 2 — after buying

**Walked as** customer 0800000107 (a completed order), 0800000104 (orders in production and waiting for payment)
and 0800000101 (a claim): คำสั่งซื้อของฉัน → the order → receipt → review → claim → สั่งซ้ำ.

What reads well (after round 0): the order page's journey strip with the factory's steps, the customer-side status
words, "สิ่งที่ต้องทำ" at the top, the receipt and the reorder flow.

| # | Finding (as the customer) | Fix |
|---|---|---|
| 2.1 | My order is delivered and complete, yet the top banner still says "สิ่งที่ต้องทำ" — there is nothing to do. | The banner reads "เสร็จสมบูรณ์" for a completed order and "ถ้าต้องการ" (review, claim) for a delivered one; "สิ่งที่ต้องทำ" only while something is actually waiting on me. |
| 2.2 | The timeline is twenty entries long; the first fifteen are history I do not need every time. | The six most recent entries show; the earlier ones fold under "ดูประวัติก่อนหน้า". |

## Round 3 — asking for a price

**Walked as** a new customer from a product page: ขอใบเสนอราคา → the RFQ form → ส่งคำขอ → คำขอใบเสนอราคา.

| # | Finding (as the customer) | Fix |
|---|---|---|
| 3.1 | I pressed ขอใบเสนอราคา on the serum box, and the form has forgotten which product I was looking at. | The product travels with the link (`?from=`); the form names it and the request carries it. |
| 3.2 | The form asks only for size, quantity and a note — but the product page offered box styles and option groups (paper, coating). I have to type them into the note. | When a category has no form of its own, the product's patterns and option groups become select fields; the summary the sales team sees labels them in Thai (`RFQ_SPEC_LABELS` in the API). |
| 3.3 | "เราจะตอบกลับทาง LINE" — I did not give LINE. | The confirmation names the notification channels I actually set. |

## Round 5 — the company

**Walked as** the company admin 0800000109: ภาพรวม → สมาชิก → รออนุมัติ → เครดิตและใบแจ้งยอด → สั่งซ้ำหลายรายการ → สาขา
→ ไฟล์แบรนด์ → ตั้งค่า → API; and as a new customer on /business/apply.

| # | Finding (as the customer) | Fix |
|---|---|---|
| 5.1 | The company has not ordered yet, and the overview shows twelve months of ฿0.00 and three "ยังไม่มีข้อมูล" panels. | One empty state — "ยังไม่มีคำสั่งซื้อในนามบริษัท" — with the way to the products. |
| 5.2 | "เครดิตคงเหลือ: ชำระก่อน" — a status where a number should be, and nothing tells me how to get credit. | Without a credit line the card is headed "เครดิต" and links to ขอวงเงินเครดิต. |
| 5.3 | Members are three cards with a badge each; a company with thirty people would scroll for a page. | A table (name · roles · joined · actions); roles are edited in one panel under it. |
| 5.4 | Credit page: six ages of overdue, all ฿0.00, before I even have credit. "ยังไม่มีใบแจ้งยอด" — when would I? | "ไม่มียอดค้างชำระ" until something is open; the statements line says one is issued at each month end with credit orders. |
| 5.5 | On the phone the company menu is a chip strip cut off after the third item. | The same single fold as the account's menu, naming this page. |
| 5.6 | Empty approvals: "ดูคำสั่งซื้อ" took me back to the overview. | It goes to คำสั่งซื้อของฉัน. |
| 5.7 | เปิดบัญชีบริษัท: my phone is pre-filled as "+6 680 0000133", and when I send the form it tells me that very number is wrong. | The account's E.164 phone is put into the field in the local form (`0800000133`). |
| 5.8 | The three KYC documents have no asterisk, yet the form will not go without them. | Marked required like every other field. |

## Round 6 — the storefront's content

**Walked** every content page at both widths: แบบกล่อง (styles, variants view), วัสดุ, เรียนรู้, ช่วยเหลือ, FAQ, search,
ติดตามคำสั่งซื้อ, about, business landing, partner-with-us, guarantee, samples, templates, studio, network, reviews,
contact, articles, how-it-works. All load, none scroll sideways on a phone, none dead-end. No change needed.

## Round 7 — photos and the stock shelf

**Walked** home → สินค้าพร้อมส่ง → a stock product → ขอราคา, /products, /styles and /configure at both widths, after
every product, style and stock item got its AI-rendered photo (D-426).

| # | Finding (as the customer) | Fix |
|---|---|---|
| 7.1 | The catalogue is drawings; I cannot tell a mailer bag from a zip pouch until I open it. | Every product, style and stock item has a photo, labelled as an AI render under the gallery. |
| 7.2 | Ready-made stock is three clicks deep in /products; I just want 500 mailer bags. | A stock shelf on the home page: chips by type, one tap to the cart at the minimum (or "ขอราคา" while stock is quote-only). |
| 7.3 | The stock page's "สั่งซื้อ" failed with an error — stock cannot be priced yet. | Quote-only stock asks for a price instead; the request names the product, SKU and minimum. |
| 7.4 | Every row of the stock details is called "คุณสมบัติ". | Each row is labelled by its kind: วัสดุ, ทรง, สี, ฝา, ความจุ. |
| 7.5 | On a phone the configurator bar cuts the total off ("รวม ฿5,178.00 · …"). | The price itself opens the details; the bar has room for the whole total. |
| 7.6 | The footer is a screenful of links on a phone. | Four disclosures below `sm`. |

## Round 8 — after buying, on a phone

**Walked as** customer 0800000101 at 390 px: บัญชี → คำสั่งซื้อ → the order waiting payment → ชำระงวดนี้ → the payment
page (QR, transfer with slip, a slip being checked) → the shipping order → การแจ้งเตือน → ข้อความ → ติดตาม.

| # | Finding (as the customer) | Fix |
|---|---|---|
| 8.1 | The notification settings are a four-column table; on a phone the browser column is off the screen and the page scrolls sideways. | A card per category with one switch row per channel below `md`; the matrix from `md`. |
| 8.2 | Two identical "ชำระงวดนี้" buttons — the deposit that is due and the balance that is not — I could not tell which one the factory waits for. | The due (or overdue) instalment keeps the primary button; a later one reads "ชำระล่วงหน้า" as a secondary button. |
| 8.3 | The slip form's date field is an empty "mm/dd/yyyy, --:--" — I just transferred, why am I typing the time? | Tapping the field fills it with now (Bangkok); left empty it is sent as now; the hint says so. |
| 8.4 | While my slip is being checked the page still offers "เปลี่ยนวิธีชำระเงิน" — I could pay twice. | The other methods are hidden while a payment is awaiting verification. |
| 8.5 | The transfer page says "โอนเข้าบัญชีตามที่ระบุในใบแจ้งหนี้" and shows no account. | Not a screen defect: the UAT database has no `payments.slip_receiver_accounts` setting. Finance sets it (admin → settings) before launch; the page then lists bank, account number and name. |

Also checked, no change needed: the orders list, the order page and its timeline, artwork upload, the shipping order's confirm / claim / reorder actions, messages, tracking — none scroll sideways, none dead-end.
