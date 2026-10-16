# UAT data for a scorecard round

> **Audience:** the moderator and note-taker of a getpack scorecard round (`moderator-guide.md`), and
> getpack-api for the same records on the UAT backend. What each participant signs in with and which
> seeded records their task cards start from (`task-cards.md` Part B). Written 2026-10-06 (U5.8).

## 1. Two ways to run a round

| | Mock UAT (now) | UAT backend (the release-gate round) |
|---|---|---|
| What it is | getpack-web on its own mock API with the dataset below: `pnpm dev:uat` (`API_MOCKS=1 MOCK_DATASET=uat`), or a production build started with the same two variables | getpack-web against the UAT getpack-api, with the same records seeded there |
| Good for | a pilot round, rehearsing the moderator guide, training note-takers | the round whose results are published in `scorecard-results/` |
| Limits | prices, lead times and documents are the mock's; nothing reaches LINE, SMS or e-mail; the dieline PDF is a placeholder (T12's layers are checked on the UAT backend) | needs getpack-api's seed (§4) — contract request `api.uat-scorecard-seed` |
| Reset between sessions | restart the server: every participant's records start again | getpack-api's seed job, per participant |

Each participant has an account of their own, so a claim, a reorder or an accepted job in one session
never changes what the next participant sees. The names are invented and marked "(ข้อมูลจำลอง)";
the products are getpack's own catalogue rows. Nothing here is a real person or company.

## 2. Round sheet

Sign in with the phone below and OTP **000000**. Every delivered order is the T1 mailer box sized for
that business, delivered yesterday 3 % short (within the ± 5 % tolerance), with its tax invoice /
receipt. The T7 link is the path the order's LINE notification opens (D-299): send
`<UAT host><path>` to the test phone in LINE before the session.

| Code | Segment | Account | Phone | T8–T10 delivered order · tax invoice | T7 in-production order | T7 notification link (path) | T11 job |
|---|---|---|---|---|---|---|---|
| P01 | food | ร้านขนมบ้านใบเตย (ข้อมูลจำลอง) | 0950000101 | PK-2569-00138 · TR-2569-00838 | PK-2569-00139 | `/l/sMOCKeyJwYXRoIjoiL2FjY291bnQvb3JkZXJzLzAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTZmNzI2NDAwMDAyOCIsImN1c3RvbWVySWQiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwYTAwMDEifQ` | J-2569-00340 |
| P02 | food | โรงคั่วกาแฟดอยหมอก (ข้อมูลจำลอง) | 0950000102 | PK-2569-00141 · TR-2569-00841 | PK-2569-00142 | `/l/sMOCKeyJwYXRoIjoiL2FjY291bnQvb3JkZXJzLzAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTZmNzI2NDAwMDAyYiIsImN1c3RvbWVySWQiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwYTAwMDIifQ` | J-2569-00343 |
| P03 | cosmetics | แบรนด์สบู่ใบบัว (ข้อมูลจำลอง) | 0950000103 | PK-2569-00144 · TR-2569-00844 | PK-2569-00145 | `/l/sMOCKeyJwYXRoIjoiL2FjY291bnQvb3JkZXJzLzAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTZmNzI2NDAwMDAyZSIsImN1c3RvbWVySWQiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwYTAwMDMifQ` | J-2569-00346 |
| P04 | cosmetics | ลีลาวดีสกินแคร์ (ข้อมูลจำลอง) | 0950000104 | PK-2569-00147 · TR-2569-00847 | PK-2569-00148 | `/l/sMOCKeyJwYXRoIjoiL2FjY291bnQvb3JkZXJzLzAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTZmNzI2NDAwMDAzMSIsImN1c3RvbWVySWQiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwYTAwMDQifQ` | J-2569-00349 |
| P05 | ecommerce | ร้านเสื้อยืดลายเส้น ออนไลน์ (ข้อมูลจำลอง) | 0950000105 | PK-2569-00150 · TR-2569-00850 | PK-2569-00151 | `/l/sMOCKeyJwYXRoIjoiL2FjY291bnQvb3JkZXJzLzAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTZmNzI2NDAwMDAzNCIsImN1c3RvbWVySWQiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwYTAwMDUifQ` | J-2569-00352 |
| P06 | ecommerce | ร้านอุปกรณ์มือถือ ทันใจ (ข้อมูลจำลอง) | 0950000106 | PK-2569-00153 · TR-2569-00853 | PK-2569-00154 | `/l/sMOCKeyJwYXRoIjoiL2FjY291bnQvb3JkZXJzLzAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTZmNzI2NDAwMDAzNyIsImN1c3RvbWVySWQiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwYTAwMDYifQ` | J-2569-00355 |
| P07 | procurement | ฝ่ายจัดซื้อ สยามฟู้ดโปรดักส์ (ข้อมูลจำลอง) | 0950000107 | PK-2569-00156 · TR-2569-00856 | PK-2569-00157 | `/l/sMOCKeyJwYXRoIjoiL2FjY291bnQvb3JkZXJzLzAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTZmNzI2NDAwMDAzYSIsImN1c3RvbWVySWQiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwYTAwMDcifQ` | J-2569-00358 |
| P08 | procurement | ฝ่ายจัดซื้อ เฮลท์ตี้ไลฟ์ (ข้อมูลจำลอง) | 0950000108 | PK-2569-00159 · TR-2569-00859 | PK-2569-00160 | `/l/sMOCKeyJwYXRoIjoiL2FjY291bnQvb3JkZXJzLzAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTZmNzI2NDAwMDAzZCIsImN1c3RvbWVySWQiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwYTAwMDgifQ` | J-2569-00361 |
| P09 | designer | นักออกแบบอิสระ ภูมิ (ข้อมูลจำลอง) | 0950000109 | PK-2569-00162 · TR-2569-00862 | PK-2569-00163 | `/l/sMOCKeyJwYXRoIjoiL2FjY291bnQvb3JkZXJzLzAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTZmNzI2NDAwMDA0MCIsImN1c3RvbWVySWQiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwYTAwMDkifQ` | J-2569-00364 |
| P10 | designer | สตูดิโอออกแบบ มะลิ (ข้อมูลจำลอง) | 0950000110 | PK-2569-00165 · TR-2569-00865 | PK-2569-00166 | `/l/sMOCKeyJwYXRoIjoiL2FjY291bnQvb3JkZXJzLzAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTZmNzI2NDAwMDA0MyIsImN1c3RvbWVySWQiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwYTAwMTAifQ` | J-2569-00367 |

`mocks/uat.test.ts` fails when this table and the dataset (`mocks/uat.ts`) disagree.

## 3. Per task: what the moderator prepares

| Task | Start state | How |
|---|---|---|
| T1, T12 | home page, signed out | a private window |
| T2 | a new design of the T1 box in the studio | signed in as the participant, open `/studio/new`, choose the box in "ตั้งค่ากล่อง" (20 × 15 × 8 cm) and start; the participant's logo file on the device |
| T3 | the T2 design with the seeded issues | before the task, in the participant's design: add a heading and set its size to 1.5 pt (small text), upload `low-res-logo.png` (≈ 150 px wide) — the same two issues the T3 step counter seeds |
| T4 | the T3 design, signed in | continue from T3; the company address and tax profile are the account's defaults |
| T5 | the T1 box's product page, signed in | `/products/mailer-box` |
| T6 | the configurator for the T1 box at 500 pcs, above 8 ฿ a piece | home quick start: กล่องไปรษณีย์, 20 × 15 × 8 cm, 500 pcs |
| T7 | the LINE notification | the link of §2, sent beforehand |
| T8–T10 | the order list, signed in | `/account/orders` |
| T9 | two photos on the device | `claim-1.jpg` (product), `claim-2.jpg` (carton) |
| T11 | the partner zone on the Android phone, signed in | `owner@factory.invalid` / `mock-password`, the job of §2 — see the note below |

**T11 note (finding).** The task card says "signed in as a floor operator", but in getpack-api's RBAC
only the factory **owner** and **planner** hold `factory_jobs.respond`, which accepting a job needs;
an operator reports steps only. The step counter signs in as the owner. Either the task card names
the planner, or the operator gets the accept permission — a decision for the Partner Manager before
the round on the UAT backend.

## 4. The same records on the UAT backend (`api.uat-scorecard-seed`)

For each participant P01–P10, getpack-api's UAT seed creates — through its own services, so every
fact, document and journal entry is real:

1. A customer with the phone of §2 (OTP sign-in), consents answered, the delivery address (the
   province and postcode of `mocks/uat.ts`), and for a company a juristic tax profile (head office).
2. **Delivered order** — the mailer box (corrugated, inside size and quantity of `mocks/uat.ts`),
   paid, artwork approved, produced at the launch factory, delivered yesterday at 97 % of the
   quantity with POD, tax invoice / receipt issued, claim window open (D-082).
3. **In-production order** — same product, paid, artwork approved, its job in progress at printing,
   promised to ship in three days, and the notification deep link (D-299) for that order with a
   72-hour validity refreshed on the morning of the session.
4. **Waiting job** — a third paid order whose production job is released to the launch factory and
   not yet accepted (acceptance due within a business day, D-074).
5. A reset per participant (delete or re-seed the three orders and the customer's claims, samples,
   quotations and designs), run between sessions.

Shipping zones and rates for the participants' postcodes must exist, which is the gap that stops the
integration run's checkout today (`api.dev-seed-launch-path`).
