# Packio UX/UI Audit & Spec — Flow 1: Order-to-Production

Oct 6, 2026 · @Superball

> **Terminology note (Phase 4.5, 2026-10-07).** This document predates the Proof wording. Where it says **ปรู๊ฟ**, read **Proof** for statuses, the back office, the factory app and page names ("รอ Proof", "Proof อนุมัติแล้ว", "ไฟล์งานและ Proof"), and **แบบตัวอย่าง** for the file in customer copy ("อนุมัติแบบตัวอย่าง v2", "ไฟล์และแบบตัวอย่าง") — the step is **ตรวจแบบก่อนพิมพ์**. The rule lives in `docs/ui/glossary.md`; text the API still writes the old way is mapped at display (`src/i18n/terms.ts`).

## ขอบเขตและวิธีตรวจ

ตรวจ Flow 1 "ลูกค้าสั่งซื้อ → CS รับงาน → โรงงานผลิต" บน dev build (`localhost:3001` ฝั่งลูกค้า, `admin.localhost:3001` หลังบ้าน) ที่ viewport 1054×685 และตรวจ markup/token ผ่าน DevTools วันที่ 6 ต.ค. 2569

| ส่วน | หน้าที่ตรวจแล้ว | สถานะ |
| --- | --- | --- |
| ลูกค้า (guest) | หน้าแรก, `/products`, `/products/corrugated`, `/studio/new`, `/sign-in`, `/cart` | ตรวจได้ |
| ลูกค้า (login แล้ว) | `/account`, `/account/orders`, checkout, ชำระเงิน, อนุมัติปรู๊ฟ | **ตรวจไม่ได้** — OTP verify ล้มเหลว (ดูบั๊ก #1) |
| หลังบ้าน (cs-lead) | `/login`, `/` dashboard, `/orders`, `/orders/[id]`, `/cs`, `/production`, `/customers` | ตรวจได้ |
| หลังบ้าน (ยังไม่ตรวจ) | `/approvals`, `/quotations`, `/rfq`, `/prepress`, `/shipments`, `/claims`, `/catalogue`, `/reports` | รอบถัดไป (Flow 2–3) |

บัญชีที่ใช้: พนักงาน `cs-lead@example.invalid` (role Dev CS Lead), ลูกค้าทดสอบเบอร์ `0800000101` และ `0800000102`

## บั๊กที่บล็อกการใช้งาน (แก้ก่อนปรับ UI)

บั๊ก #1 ทำให้ลูกค้าเข้าระบบไม่ได้เลย จึงต้องแก้ก่อน UAT รอบถัดไป ส่วน #2–#3 กระทบ first impression ของทั้งสองฝั่ง

| # | อาการ | Repro | สาเหตุที่น่าจะเป็น | แนวทางแก้ |
| --- | --- | --- | --- | --- |
| 1 | ยืนยัน OTP ล้มเหลว "กรุณาใส่เบอร์มือถือในประเทศไทยให้ถูกต้อง" ทุกครั้ง | `/sign-in` → ใส่ `0800000101` → ขอรหัส OTP (ผ่าน, ขึ้น "ส่งรหัส 6 หลักไปที่ 0800000101 แล้ว") → ใส่ `000000` → ยืนยัน → error + request id | step request ส่งเบอร์รูป `0800000101` แต่ step verify ส่งเบอร์ที่ถูกแปลงเป็น `+66800000101` หรือตัด 0 แล้ว validator ฝั่ง API (`packio-api` auth/otp verify DTO) รับเฉพาะ `^0[689]\d{8}$`; ถ้าใส่ `800000101` ตั้งแต่แรกจะถูกปฏิเสธที่ step request แทน → ยืนยันว่า normalize คนละแบบ | ทำ `normalizeThaiMobile()` ที่เดียวใน shared lib คืนค่า E.164 (`+66…`) ใช้ทั้ง request/verify ทั้ง web และ api; DTO ทั้งสอง endpoint ใช้ validator เดียวกัน; เพิ่ม e2e test request→verify ด้วยเบอร์ `0800000101` |
| 2 | หลังบ้าน login สำเร็จแล้ว redirect ไปหน้า 404 ("ไม่พบหน้านี้") | `admin.localhost:3001/login` → กรอก cs-lead → เข้าสู่ระบบ → 404; พิมพ์ `/` เองจึงเข้า dashboard ได้ | `returnTo` ชี้ไปที่ `/login` เดิมหรือ path ที่ไม่มี route บน admin host | หลัง login สำเร็จ: ไป `returnTo` เฉพาะเมื่อเป็น path ภายใต้ admin host และไม่ใช่ `/login`/`/sign-in`, ไม่เช่นนั้นไป `/` |
| 3 | `/cart` บังคับ login ก่อนเห็นตะกร้า (redirect ไป `/sign-in?returnTo=/cart`) | guest คำนวณราคา → กดดูตะกร้า → เจอ sheet login | guard ที่ route group `(customer)` ครอบ `/cart` | ให้ guest ดูและแก้ตะกร้าได้ (เก็บใน cookie/local cart id) และบังคับ login ที่ขั้น checkout เท่านั้น — ตรงกับที่หน้าแรกโปรโมตว่า "ไม่ต้องสมัครสมาชิก" |
| 4 | ลิงก์ "เข้าสู่ระบบ" บน navbar ชี้ `/account` แล้วค่อย redirect ไป `/sign-in` | กดจาก header | ใช้ `/account` เป็นทางเข้า | ชี้ `/sign-in?returnTo=<current path>` โดยตรง ลด redirect 1 ครั้งและพาผู้ใช้กลับหน้าเดิมหลัง login |
| 5 | admin `/orders` ขึ้น Next.js dev overlay "2 Issues" | เปิด `/orders` | hydration/console error บนตารางคำสั่งซื้อ | ตรวจ console ตอนรัน และเคลียร์ก่อน UAT |

ทุก error state ตอนนี้โชว์ request id (UUID) เต็มให้ลูกค้าเห็น ควรย่อเป็น "รหัสอ้างอิง PK-xxxx" และซ่อน UUID ไว้ใน log/clipboard-copy แทน

## Design system baseline (ใช้ร่วมทั้งสองแอป)

คง token `--sem-*` เดิม (primary `#0d7a66`, accent `#e08a18`, bg `#fbf8f3`, kraft `#e7d8c0`) แต่กำหนดกติกาการใช้ให้เข้มขึ้น เพราะปัญหาหลักของ UI ปัจจุบันไม่ใช่สี แต่เป็นการใช้ component ไม่สม่ำเสมอและ spacing แน่น

| หมวด | กติกา | ค่า |
| --- | --- | --- |
| Typography | ฟอนต์ไทย/ละตินชุดเดียว เพื่อให้ x-height เท่ากัน | Anuphan (Google Fonts) หรือ IBM Plex Sans Thai; display 64/48/38, h3 18–20, body 15–16, caption 13, line-height 1.6–1.7 สำหรับภาษาไทย |
| Spacing | scale 4 โดยใช้ค่าใหญ่ขึ้นกว่าปัจจุบัน | section gap 96–104, card padding 24–26, grid gap 16–20, form field gap 20, page gutter 32 (มือถือ 20) |
| Container | กว้างขึ้นจาก `max-w-6xl` (1152) | content 1180, navbar 1320, admin content เต็มกว้าง มี max 1440 |
| Radius | 3 ระดับเท่านั้น | control 12, card 20, hero/band 28, pill 999 |
| Buttons | primary 1 ปุ่มต่อพื้นที่; สีแดงใช้เฉพาะ destructive และเป็น outline/ghost เสมอ | h 52 (hero/form), 44 (navbar/table action), 40 (in-card); primary มี shadow เขียวจาง |
| Shadow | ใช้เฉพาะ hover และ floating element | card hover `0 20px 40px -24px rgba(60,40,20,.35)`; ไม่ใส่ shadow บน card ปกติ |
| Status chips | สีตามความหมาย ไม่ใช่ตามหมวด | รอลูกค้า = accent-subtle, รอทีม = primary-subtle, ล่าช้า/เสี่ยง = danger-subtle, เสร็จ = success-subtle; สูง 24, มี icon 14 นำหน้า |
| Imagery | ห้ามใช้ lucide `Package` เป็นรูปสินค้า | illustration ต่อ product type 13 แบบ (line-art บนพื้น kraft) + รูปจริงเมื่อมี |
| Empty/Error state | มี icon + หัวข้อ + 1 ประโยค + action เดียว | ไม่โชว์ UUID; รหัสอ้างอิงสั้นใน tooltip/copy |
| Mobile | sheet ใช้เฉพาะ < md | ≥ md ใช้ centered dialog กว้าง 480 หรือหน้าเต็ม |

หลังบ้านใช้ชุดเดียวกันแต่ density สูงกว่า: body 14, row height 56, card padding 20, radius card 16

## ฝั่งลูกค้า: สินค้า → ปรับแต่ง → ตะกร้า → บัญชี

โครงสร้าง flow ดีแล้ว (list → detail → `/configure/[slug]` มี 3D preview + ตารางราคาตามจำนวน) ปัญหาอยู่ที่การเรียงลำดับเนื้อหา, รูป placeholder และ UI ซ้ำซ้อน สั่งทำตามลำดับในตาราง

| หน้า | ปัญหาที่พบ | Spec ที่ต้องทำ |
| --- | --- | --- |
| `/products` (รวม) | เรียง "บริการ" (ออกแบบกราฟิก, ม็อกอัป) ขึ้นก่อนกล่อง; sidebar 14 หมวดเป็น list ยาว; ช่องค้นหามีปุ่ม "ค้นหา" แยก | 1) เรียงหมวด: ราคาทันที (ลูกฟูก, สินค้ามาตรฐาน) → สั่งผลิต RFQ → บริการล่างสุด 2) หัวหน้าเป็น category tiles 4×4 มี illustration แทน sidebar บนหน้ารวม; sidebar ใช้เฉพาะหน้าหมวด 3) search เป็น input เดียวมีไอคอน ค้นขณะพิมพ์ 4) toggle ตาราง/รายการ เป็น segmented icon คู่ |
| `/products/[category]` | หัวข้อ 56px ใหญ่เกินหน้า list; ไม่มีคำอธิบายหมวด/จำนวนรายการ; ไม่มี sort/filter (ราคา, ขั้นต่ำ, วันผลิต) | หัวข้อ 38px + 1 บรรทัดอธิบาย + "12 รายการ"; แถบ filter chips: ราคาทันที / RFQ / ขั้นต่ำ ≤ 100 / ผลิต ≤ 5 วัน + dropdown เรียงตาม |
| Product card | รูปเป็นไอคอน `Package` ทุกใบ; badge "ราคาทันที" และ "กล่องไปรษณีย์ลด 10%" ซ้อนกันมุมซ้ายบน; ราคาเก่าขีดทับอยู่คนละบรรทัดกับราคาใหม่ | รูป 4:3 illustration ต่อประเภท; badge หลักมุมซ้ายบน badge โปรโมชันมุมขวาบน (สี accent); ราคา: `เริ่มต้น ฿14.13 / ชิ้น` ตัวหนา + `฿15.70` ขีดทับสีเทาบรรทัดเดียวกัน; บรรทัดล่าง `ขั้นต่ำ 100 · ผลิต 5 วัน` เป็น caption 13px; hover ยกการ์ด + โชว์ปุ่ม "ดูราคา" |
| `/products/[slug]` (detail) | กล่องรูป "ยังไม่มีรูปสินค้า" กินครึ่งจอ; กล่องราคามีข้อความ 6 บรรทัดก่อนถึงปุ่ม; ปุ่ม 3 ระดับ (primary/outline/text) วางไม่เป็นระเบียบ; ตารางขนาด 11 แถวไม่คลิกได้ | ซ้าย: gallery ใช้ dieline/3D render ของแบบกล่องแทน placeholder; ขวา: ชื่อ → ราคาใหญ่ + "ที่ 300 ชิ้น · รวม VAT" → 3 ไอคอนสั้น (ผลิต 5 วัน / ขั้นต่ำ 100 / รับประกัน) → ปุ่ม primary "ปรับแต่งและดูราคา" เต็มกว้าง + แถวล่าง outline 2 ปุ่ม (ดาวน์โหลดแบบ / สอบถาม); ข้อความสเปกอ้างอิงย้ายไป tooltip; ตารางขนาดมาตรฐานแต่ละแถวกดไป configure พร้อม preselect ขนาด |
| `/configure/[slug]` | การ์ด "วันนี้อยากเริ่มจากอะไร" โผล่ซ้ำกับ studio และกินพื้นที่เหนือ 3D; step 4 "การจัดส่ง" ยังไม่ทำแต่ step 5–6 ติ๊กถูกแล้ว (สับสน); 3D preview กล่องเทาไม่มีสี/ลาย; ปุ่ม "ใส่ตะกร้า" อยู่ใต้ตารางจำนวน หลุดจอ | ตัดการ์ด intent ออก (แสดงครั้งเดียวที่ studio); layout 2 คอลัมน์ 7:5 — ซ้าย 3D sticky บน + stepper ลำดับบังคับ (ห้ามติ๊กข้าม step ก่อนหน้า), ขวา price panel `position: sticky; top: 96px` มี ยอดรวม + วันส่ง + ปุ่ม "ใส่ตะกร้า" เห็นตลอด; ตาราง tier จำนวนแสดง "ประหยัด x%" เทียบ tier แรก; 3D ใส่สีวัสดุ (kraft/ขาว) และโลโก้หลังอัปโหลด; มือถือ: price bar ติดล่างจอ |
| `/cart` | บังคับ login (บั๊ก #3) จึงยังไม่เห็น UI | spec หลังแก้บั๊ก: ซ้าย line items (รูป dieline, สเปก 3 บรรทัด, จำนวน stepper, ราคา, ลบ/แก้) ขวา summary sticky (ยอด, ค่าส่งอ้างอิง, VAT, ปุ่ม "ดำเนินการชำระ" → ถ้า guest ค่อยขึ้น sign-in) + การ์ดเตือน "ไฟล์งานยังไม่ครบ" ต่อ item |
| `/account`, `/account/orders` | ยังเข้าไม่ได้ (บั๊ก #1) | จะตรวจและ spec ในรอบถัดไปหลังแก้ OTP — หลักการ: order card แสดง timeline 5 ขั้น (ไฟล์ → ปรู๊ฟ → ผลิต → ส่ง → รับของ) และ "สิ่งที่คุณต้องทำ" เป็น action เดียวบนการ์ด |

## ฝั่งลูกค้า: เข้าสู่ระบบ (OTP)

เปลี่ยนจาก bottom sheet เต็มจอบนเดสก์ท็อป เป็นหน้าเต็มแบบ split (แผงแบรนด์ซ้าย / ฟอร์ม 440px ขวา) ตาม mockup ใน [Packio Homepage Redesign — artboard "Sign in"](https://claude.ai/artifact/6fn5Lvyqa1VeY4TgfrJTUk)

| หัวข้อ | Spec |
| --- | --- |
| Route | `/sign-in` เป็นหน้าเต็ม ซ่อน navbar/footer; เปิดจากปุ่ม "เข้าสู่ระบบ" ในหน้าอื่นที่ ≥ md ใช้ centered dialog 480px; < md ใช้ bottom sheet เดิม |
| Step 1 เบอร์ | ช่องเดียว `type=tel inputmode=numeric autocomplete=tel-national`, prefix ธง + `+66` เป็นปุ่ม (รองรับประเทศอื่นภายหลัง), auto-format `081 234 5678`, รับทั้ง `08x` และ `8x` แล้ว normalize เอง; ปุ่ม primary เปิดเมื่อครบ 10 หลัก |
| Social | ปุ่ม outline มีโลโก้แบรนด์จริง (Google, Apple) และ LINE สี `#06C755` ตาม brand guideline; ข้อความ "ดำเนินการต่อด้วย …" |
| Step 2 OTP | 6 ช่องแยก 64px auto-advance + paste ทั้งรหัส; แสดงเบอร์ + ลิงก์แก้ไข, รหัสอ้างอิงสั้น (`PK-7F3A`), countdown 5 นาที, "ส่งอีกครั้ง" เปิดหลัง 60 วิ; verify อัตโนมัติเมื่อครบ 6 หลัก |
| Error | ข้อความใต้ช่อง (inline) ไม่ใช่ banner ด้านบน; ไม่แสดง UUID |
| หลัง login | กลับ `returnTo` เสมอ; ถ้ามาจาก configure/cart ให้ merge guest cart เข้าบัญชี |

## หลังบ้าน: Login → Dashboard → คำสั่งซื้อ → ผลิต

หลังบ้านมีโครงสร้างดี (sidebar 5 กลุ่ม 16 โมดูล, ค้นหา ⌘K, ตารางมี saved view/column picker/export) งานหลักคือใส่ลำดับความสำคัญและลดระยะทางไปถึง action

| หน้า | ปัญหาที่พบ | Spec ที่ต้องทำ |
| --- | --- | --- |
| `/login` (พนักงาน) | ฟอร์มลอยกลางจอไม่มีโลโก้/แบรนด์; ไม่มี show password, ลืมรหัส, หรือลิงก์ไป portal โรงงาน | ใช้ layout เดียวกับ sign-in ลูกค้าแต่แผงซ้ายสี `#1e1b18` + ข้อความ "ระบบหลังบ้าน Packio"; ฟอร์ม: อีเมล, รหัสผ่าน (toggle ตา), ปุ่ม primary, ลิงก์ลืมรหัส, เส้นคั่น + ลิงก์ "เข้าสู่ระบบโรงงานพันธมิตร" |
| `/` Dashboard | การ์ดคิวงาน 11 ใบขนาดเท่ากันหมด ไม่มีสีแยกด่วน/ปกติ; การ์ดค่า 0 กินที่เท่าการ์ดที่มีงาน; ข้อความ "ไม่มีงานใกล้ครบกำหนด" เป็นสีแดงทั้งที่เป็นข่าวดี | แถวบน "ต้องทำวันนี้" = การ์ดใหญ่ 3–4 ใบเฉพาะคิวที่มีงาน เรียงตาม SLA ใกล้หมด (เส้นขอบซ้ายสี danger/warning/primary); คิวอื่นยุบเป็นแถว list เล็ก "ชื่อคิว · จำนวน" คิวค่า 0 หรียหรือซ่อน; ข้อความรองใช้สี muted เมื่อปกติ สี danger เฉพาะเกินกำหนด; เพิ่มแถบ "งานที่แท็กถึงฉัน" ด้านขวา |
| `/orders` | ปุ่มรอง 2 ปุ่ม (ตัวอย่างสินค้า / คำขอออกแบบ) อยู่ระดับเดียวกับหัวเรื่อง; ช่องค้นหามี label แยกบรรทัดกินที่; ตารางล้นขวา (8 คอลัมน์ที่ 1054px); วันที่ขึ้น 2 บรรทัด | ปุ่มรองย้ายไป sidebar (เป็นโมดูลของตัวเอง); toolbar บรรทัดเดียว: search (placeholder แทน label) · filter chips · ขวา = มุมมอง/คอลัมน์/ส่งออก + primary; คอลัมน์ default 6: เลขที่+สินค้า, ลูกค้า, ยอด, สถานะ (chip เดียว + sub-status เป็น tooltip), กำหนดส่ง (`20 ต.ค.` บรรทัดเดียว + สีเมื่อใกล้), เจ้าของ; คลิกทั้งแถว; เลขคำสั่งซื้อใช้ mono สีเขียวเฉพาะรหัส ไม่ใช่ทั้งเซลล์ |
| `/orders/[id]` | หัวหน้า sticky สูง \~170px กินพื้นที่; ปุ่มแดง "ยกเลิกคำสั่งซื้อ" เป็นปุ่มเด่นที่สุด; action ที่ควรทำต่อ (ยืนยันชำระ/ส่งปรู๊ฟ) ซ่อนใน "การดำเนินการอื่น"; 8 tab + เนื้อหายาว (ภาพรวม, บันทึก, ไทม์ไลน์) ใน tab เดียว | หัวหน้าบรรทัดเดียว (เลขที่ · chip สถานะ · ลูกค้า · ยอด) + ขวา = **ปุ่ม primary ตามสถานะ** (รอชำระ → "ยืนยันการชำระ", รอไฟล์ → "ส่งปรู๊ฟ") + เมนู ⋯ รวม ยกเลิก (สีแดงในเมนู); layout 2 คอลัมน์ 8:4 — ซ้าย tab content, ขวา rail sticky: ไทม์ไลน์สถานะ 5 ขั้น + กำหนดส่ง + บันทึกภายใน (collapsed); ภาพรวมเป็น 2 การ์ด: ลูกค้า / สินค้า+สเปก |
| `/production` | บอร์ด Kanban มีแค่ 2 คอลัมน์ที่มีงาน คอลัมน์ว่างหายไป; คำอธิบายหน้ามีรหัสภายใน "(D-074, D-075)"; filter สองแถวไม่เรียงแนว | แสดงทุก stage คงที่ (รอโรงงานรับ → วัตถุดิบ → พิมพ์ → หลังพิมพ์ → QC → พร้อมส่ง) แม้ว่าง (คอลัมน์เทาจาง + "ไม่มีงาน"), สกรอลแนวนอน; การ์ดงาน: รหัส, สินค้า+จำนวน, โรงงาน chip, กำหนดส่ง (สีตามความเสี่ยง), progress bar บาง; เอารหัส D-xxx ออกจาก UI; filter เป็นแถวเดียว |
| ทุกหน้า | ชื่อ user "DL" มุมขวาไม่บอก role; sidebar ไม่มี badge จำนวนงานรอ | avatar + ชื่อ + role เมื่อ sidebar กาง; badge ตัวเลขท้ายเมนู (รออนุมัติ, คำสั่งซื้อ, เคลม) |

## ปัญหาระดับระบบ (ทุกหน้า)

- Cookie banner ลอยทับ CTA ทุกหน้าจนกว่าจะกด → ย้ายเป็นแถบล่างสุดเต็มกว้างสูง 56px หรือการ์ดมุมซ้ายล่างกว้าง 360px; ไม่แสดงใน studio/configure/checkout
- รูปสินค้าเป็นไอคอน `Package` ทุกที่ (หน้าแรก, list, detail, cart) → ชุด illustration 13 ประเภท + render dieline ของแบบกล่องจาก studio engine เป็น fallback อัตโนมัติ
- Error state โชว์ UUID เต็ม ("รหัสคำขอ: 5fe1ecce-…") → รหัสอ้างอิง 6 ตัว + ปุ่มคัดลอก; UUID เก็บใน log
- หน้า 404 ทั้งสองแอปไม่มี navbar/โลโก้ (หลังบ้าน) หรือมีหัวข้อซ้ำ 2 ครั้ง (ลูกค้า) → ใช้ layout ปกติ + illustration กล่องเปิดเปล่า + 3 ลิงก์เดิม
- Copy บางจุดยังมีรหัสภายใน ("D-074", "D-100", "\[DEV\]", "(รีวิวทดสอบ UAT)") → กวาดออกก่อน UAT จริง
- A11y: ปุ่มไอคอนใน navbar มี aria-label แล้ว แต่ badge สีเทาอ่อน (`#948a7f` บนขาว = 3.4:1) ใช้กับตัวหนังสือ 12–13px หลายจุด → ใช้ `#5b534b` (6.3:1) สำหรับ caption; focus ring ใช้ outline 2px primary ทุก control
- ภาษา: ปุ่มสลับภาษามีแต่ไอคอนโลก → แสดง "TH" / "EN" กำกับ

## แผนลงมือและ prompt สำหรับ Claude Code

ทำตามลำดับ — ขั้น 1 ปลดล็อกการทดสอบฝั่งลูกค้า ขั้น 2 ให้ทุกหน้าดูดีขึ้นพร้อมกันโดยแก้ที่ shared component ขั้น 3–5 ไล่ทีละหน้าตาม mockup

| ลำดับ | งาน | Repo | Prompt สำหรับ Claude Code |
| --- | --- | --- | --- |
| 1 | แก้บั๊ก #1–#4 | packio-api, packio-web | `Fix customer OTP: create shared normalizeThaiMobile() returning E.164; use it in both request-otp and verify-otp DTOs and in the web sign-in form; accept 08x and 8x input; add e2e test with 0800000101/000000. Fix admin post-login redirect to ignore /login and /sign-in returnTo and fall back to /. Allow guest access to /cart; require auth only at /checkout. Header login link goes to /sign-in?returnTo=<current>.` |
| 2 | Shared UI tokens + components | packio-web | `Apply the design baseline: Anuphan font (Thai+Latin) via next/font; type scale 64/48/38/20/16/13; radius tokens control 12 / card 20 / band 28; Button variants primary/outline/ghost/destructive-ghost at heights 52/44/40; StatusChip component with semantic colors; EmptyState and ErrorState components that show a short reference code and hide the UUID behind a copy button; ProductImage component that renders a dieline/illustration fallback by productType instead of the lucide Package icon; move the cookie banner to a 56px bottom bar hidden on /studio, /configure, /checkout.` |
| 3 | Sign-in (ลูกค้า + พนักงาน) | packio-web | `Rebuild /sign-in as a full-page split layout per the Design mockup (brand panel left, 440px form right); at >= md render as page, at < md keep the bottom sheet; OTP step with six 64px inputs, auto-advance, paste, 5-min countdown, resend after 60s, inline errors. Reuse the same layout for admin /login with the dark brand panel and a link to the partner portal.` |
| 4 | Products list / category / detail / configure | packio-web | `Products: order categories instant-price first, services last; category tiles with illustrations on /products; filter chips (instant price, RFQ, MOQ <= 100, lead time <= 5 days) and sort on category pages; ProductCard with 4:3 illustration, badges top-left/top-right, price line and caption per spec. Product detail: dieline gallery, compact price card (price, 3 meta icons, one primary CTA + two outline), standard-size rows link to /configure with size preselected. Configure: remove the intent card, 7:5 layout with sticky 3D preview and sticky price panel including the add-to-cart button, enforce step order, show savings % per quantity tier, mobile bottom price bar.` |
| 5 | Admin dashboard / orders / production | packio-web (admin) | `Admin: dashboard with a Today row of 3-4 large cards sorted by SLA with left color stripes and a compact list for the other queues (hide zero counts); orders list single-line toolbar, 6 default columns, row click, due date single line with color when near; order detail one-line header with a status-driven primary action and an overflow menu holding cancel, 8:4 layout with a sticky right rail (5-step timeline, due date, collapsed internal notes); production board showing all stages as columns with empty states, risk-colored due dates, no internal D-codes in copy; sidebar user block with name + role and count badges on queue menu items.` |

รอบถัดไป (Flow 2): ใบเสนอราคา/RFQ → อนุมัติ → ปรู๊ฟ และ Flow 3: จัดส่ง → เคลม → เอกสารภาษี — เริ่มได้หลังแก้บั๊ก #1 เพราะต้องเข้าฝั่งลูกค้า

Mockup ทุกหน้าอยู่ใน [Packio Homepage Redesign (Claude Design)](https://claude.ai/artifact/6fn5Lvyqa1VeY4TgfrJTUk) — artboard: Homepage, Sign in ×2, Product category, Product detail, Configure, Admin dashboard, Admin order detail

## Flow 2 — ใบเสนอราคา / RFQ → อนุมัติ → ไฟล์งานและปรู๊ฟ

โมดูลกลุ่มนี้ใช้ list pattern เดียวกันทั้งหมด (tab สถานะ → ช่องค้นหา 2–3 แถว → ตาราง) จุดอ่อนหลักคือหน้า detail เป็นการ์ดซ้อนกันลงมาโดยไม่มี "สิ่งที่ต้องทำต่อไป" อยู่บนสุด และ SLA กับผู้รับผิดชอบถูกซ่อนอยู่ท้ายหน้า

| หน้า | ปัญหาที่พบ | Spec ที่ต้องทำ |
| --- | --- | --- |
| `/rfq` (list) | tab 7 อันล้นขวา; filter 2 แถว 6 ช่อง; คอลัมน์ SLA แสดงข้อความ "ตอบกลับภายใน SLA" 3 บรรทัดแทนเวลาที่เหลือ; คำอธิบายมีรหัส D-100 | tab เหลือ 4: ใหม่ · ของฉัน · รอลูกค้า/โรงงาน · ทั้งหมด (ที่เหลือเป็น filter chip); คอลัมน์ SLA = countdown `เหลือ 5 ชม.` สีตามระดับ (เขียว > 50%, ส้ม < 50%, แดงเกิน); เรียง default ตาม SLA ใกล้หมด; แถวไม่มีผู้รับผิดชอบแสดงปุ่ม "รับงาน" inline |
| `/rfq/[id]` | header มีแค่ "มอบหมาย" + dropdown; การ์ด รายละเอียด/สเปก/ไฟล์/SLA/ผู้รับผิดชอบ/ลูกค้า เรียงต่อกัน 6 ใบ (สเปกซ้ำกับรายละเอียด, มี label อังกฤษ "material" หลุด); tab ราคาโรงงาน/ใบเสนอราคา/ข้อความ ไม่มี badge บอกว่ามีอะไรรอ | header: เลขที่ · chip สถานะ · SLA countdown · ผู้รับผิดชอบ (avatar + เปลี่ยน) → ขวา = primary ตามสถานะ (รอข้อมูล → "ถามลูกค้า", มีราคาโรงงาน → "สร้างใบเสนอราคา"); layout 8:4 — ซ้าย tab: คำขอ (สเปก + ไฟล์รวมการ์ดเดียว, หมายเหตุลูกค้าเป็น quote block), ราคาโรงงาน (ตารางโรงงาน × ราคาต่อ tier + ปุ่มขอราคา), ใบเสนอราคา, ข้อความ (badge ยังไม่อ่าน); ขวา rail: ไทม์ไลน์ RFQ 5 ขั้น (รับคำขอ → ขอราคาโรงงาน → ออกใบเสนอ → ลูกค้าตอบ → สั่งซื้อ) + การ์ดลูกค้าย่อ |
| `/quotations` | คอลัมน์ "เลขที่" โชว์ `01a11018` (ส่วนหน้า UUID) แทนเลขเอกสาร — บั๊ก; ชื่อสินค้าตัด 3 บรรทัด; วันที่ 3 บรรทัด | เลขที่ = `UATQT-2610-00001` mono; คอลัมน์: เลขที่+สินค้า (2 บรรทัด), ลูกค้า, จำนวน, ยอด, สถานะ chip, ใช้ได้ถึง (`21 ต.ค.` + สีเมื่อ < 3 วัน); action ท้ายแถว: ส่งซ้ำ / แปลงเป็นคำสั่งซื้อ / PDF |
| `/approvals` | หน้าเป็นตารางล้วน ต้องคลิกเข้าทีละรายการเพื่ออนุมัติ; รายการที่อนุมัติแล้วปนกับรออนุมัติ | แบ่ง 2 โซน: "รอคุณอนุมัติ" = การ์ดขยายได้ (ประเภท, ผู้ขอ, จำนวนเงินใหญ่, เหตุผล 1 บรรทัด, ปุ่ม อนุมัติ / ปฏิเสธ / เปิดดู inline) และ "ประวัติ" เป็นตาราง; อนุมัติหลายรายการพร้อมกันด้วย checkbox; ยอดเงินเกินวงเงินอนุมัติของฉันแสดงสีเตือน |
| `/discount-memos` | empty state อยู่ในตารางที่ยังแสดง header 8 คอลัมน์ | empty state แทนตารางทั้งก้อน + ปุ่ม "สร้างบันทึกขอส่วนลด" (หน้านี้ไม่มีปุ่มสร้างเลย) |
| `/prepress` | 3 tab กระจายงานของคนเดียวกัน; คอลัมน์ "สถานะไฟล์งาน" ตกขอบ; ไม่มี preview ไฟล์ใน list | หน้า preflight/proof เป็น split: ซ้าย preview ไฟล์ซ้อน dieline (toggle ไฟล์/ไดไลน์/ซ้อน, zoom), ขวา checklist preflight (ขนาดตรง · bleed 3 มม. · โหมดสี · ฟอนต์ outline · ความละเอียด ≥ 300 dpi) แต่ละข้อ ผ่าน/ไม่ผ่าน/แก้ให้ + หมายเหตุ → ปุ่ม "ส่งปรู๊ฟให้ลูกค้า" / "ขอไฟล์ใหม่" (สร้างข้อความถึงลูกค้าอัตโนมัติจากข้อที่ไม่ผ่าน); ฝั่งลูกค้าหน้าอนุมัติปรู๊ฟใช้ preview เดียวกัน + ปุ่ม อนุมัติ / ขอแก้ พร้อม pin comment บนภาพ |

## Flow 3 — ผลิต → จัดส่ง → หลักฐานส่งมอบ → เคลม

ข้อมูลครบแต่การนำเสนอเป็นตารางล้วน ทั้งที่งานกลุ่มนี้เป็นเรื่องของ "ของอยู่ที่ไหน ถึงเมื่อไหร่ ใครต้องทำอะไรต่อ" ซึ่งควรเห็นเป็นไทม์ไลน์และบอร์ด

| หน้า | ปัญหาที่พบ | Spec ที่ต้องทำ |
| --- | --- | --- |
| `/production` (บอร์ด) | ดู Flow 1 — คอลัมน์ว่างหาย; tab "ตรวจคุณภาพ" แยกจากบอร์ดทั้งที่ QC คือ stage หนึ่ง | Kanban 6 stage คงที่ (รอโรงงานรับ → วัตถุดิบพร้อม → กำลังพิมพ์ → หลังพิมพ์ → QC → พร้อมส่ง) สกรอลแนวนอน; การ์ดงานแสดง รหัส · สินค้า+จำนวน · โรงงาน chip · กำหนดส่ง (สีเสี่ยง) · วันที่อยู่ใน stage นี้; กดการ์ดเปิด drawer ด้านขวา (ไม่เปลี่ยนหน้า) มี checklist QC และปุ่ม "เลื่อน stage"; มุมมองที่สอง = ตาราง/ไทม์ไลน์ตามโรงงาน |
| `/shipments` | เลขรอบส่ง `UATSH-2610-00003` หัก 3 บรรทัด; สถานะ 2 chip ซ้อน (ส่งถึงแล้ว + รอตรวจหลักฐาน); ปลายทาง 3 บรรทัด; ไม่เห็น POD จาก list | เลขที่ mono บรรทัดเดียว (คอลัมน์กว้างขั้นต่ำ 190px); สถานะเดียว "รอตรวจหลักฐาน" (ส่งถึงแล้วเป็น implied); คอลัมน์ปลายทาง = ชื่อ + จังหวัด; เพิ่ม thumbnail POD + ปุ่ม "ตรวจหลักฐาน" inline เปิด dialog: รูป POD · จำนวนส่ง/รับ · ผู้รับ · เวลา → ยืนยัน (เริ่ม claim window) / ขอหลักฐานเพิ่ม; แถวที่มีปัญหาขึ้นสี danger ซ้าย |
| `/claims` | tab 7 อันล้นขวา; เลขเคลม 3 บรรทัด; คอลัมน์ "แจ้งได้ถึง" ไม่บอกว่าเหลือกี่วัน | tab 3: เปิดอยู่ · รออีกฝ่าย · ปิดแล้ว (+ filter สถานะย่อย); คอลัมน์: เลขเคลม+คำสั่งซื้อ, ลูกค้า, ประเภท, สถานะ+ผู้รับผิดชอบ (avatar), ข้อเสนอแก้ไข, ครบกำหนดตอบ (`เหลือ 2 วัน` สีเตือน); หน้า detail: ซ้าย รูปหลักฐานจากลูกค้าเทียบกับปรู๊ฟที่อนุมัติ (side-by-side), ขวา การตัดสิน (พิมพ์ใหม่ / คืนเงินบางส่วน / เครดิต / ปฏิเสธ) + ผู้รับผิดชอบต้นทุน (Packio / โรงงาน) และไทม์ไลน์การสื่อสาร |
| `/track` (ลูกค้า) | หน้ามีแค่ช่องเดียวบนพื้นว่าง; รหัสจาก query string ไม่ถูกนำมาใส่ให้; placeholder "เช่น trk…" ไม่บอกรูปแบบ | หน้าผลลัพธ์: หัวเรื่อง เลขคำสั่งซื้อ + สินค้า → stepper 5 ขั้นแนวนอน (สั่งซื้อ → ปรู๊ฟ → ผลิต → จัดส่ง → รับของ) → การ์ด "สิ่งที่คุณต้องทำ" (เช่น อนุมัติปรู๊ฟ / ชำระงวดที่ 2) → ไทม์ไลน์เหตุการณ์เวลาจริง → ข้อมูลขนส่ง + เลขพัสดุ; รองรับ `?code=` และลิงก์จาก SMS/LINE; ปุ่ม "เข้าสู่ระบบเพื่อดูทุกคำสั่งซื้อ" |

## Studio — ออกแบบออนไลน์

Editor เป็นจุดแข็งที่สุดของระบบ (แผ่นคลี่จริง + 3D + เลือกหน้ากล่อง) ปัญหาอยู่ที่หน้าเริ่มต้นและการเชื่อมกับราคา

| ส่วน | ปัญหาที่พบ | Spec ที่ต้องทำ |
| --- | --- | --- |
| หน้าเริ่มต้น `/studio/new` | แผงซ้าย 300px มีปุ่ม 3 ปุ่ม + การ์ด intent 4 ใบที่ตัวหนังสือตัดบรรทัด 4–5 ครั้ง; canvas ว่างมีปุ่มเดียวกลางจอ; step bar ข้างบนซ้ำกับปุ่ม | หน้าเริ่มต้นเป็นหน้าเต็ม (ไม่มี canvas ว่าง): หัวข้อ "วันนี้อยากเริ่มจากอะไร" + 4 การ์ดใหญ่แนวนอน (เลือกแบบกล่อง / มีสินค้าแล้ว / มีไฟล์แล้ว / สั่งซ้ำ) มี illustration; แถว "แบบล่าสุดของคุณ" เมื่อ login; ลิงก์เล็ก "ลองเล่นกับแบบตัวอย่าง" |
| Modal เลือกกล่อง | ดีอยู่แล้ว (tab หมวด + การ์ดแบบกล่อง + preview แผ่นคลี่ขวา) แต่ช่องขนาดอยู่ใต้ fold และการ์ดมีคำอธิบาย 3 บรรทัดทุกใบ | การ์ดแบบกล่อง = ไอคอนแผ่นคลี่ + ชื่อ + 1 บรรทัด (คำอธิบายเต็มใน preview ขวา); ขนาด ก×ย×ส อยู่ในแผงขวาใต้ preview พร้อม preset ขนาดมาตรฐาน และราคาเริ่มต้น — กด "เริ่มออกแบบ" ครั้งเดียวจบ |
| Editor | โครงดี (toolbar ซ้าย, canvas กลาง, 3D + ราคาขวา) แต่ 3D กิน 1/4 ของจอตลอด; แผงราคาขึ้น "เลือกกล่องเพื่อดูราคา" ทั้งที่เลือกแล้ว (บั๊ก); ปุ่ม "สั่งผลิต" disabled ไม่บอกเหตุผล; label บนแผ่นคลี่ (ด้านหน้า/ฝา/ปีกกันฝุ่น) อ่านไม่ออกที่ zoom 28% | 3D ยุบเป็น floating card 280px มุมขวาล่างของ canvas ขยายได้ (หรือ toggle แผ่นคลี่/3D เต็มจอ); แผงขวา = inspector ของ object ที่เลือก + สรุปราคาเสมอ (สเปกจากกล่องที่เลือก, จำนวน default 300, ราคา/ชิ้น, ปุ่ม "สั่งผลิต" เปิดเมื่อผ่านตรวจงาน หรือแสดงเหตุผล "ยังไม่ผ่านตรวจงาน 2 ข้อ"); label แผ่นคลี่ซ่อนเมื่อ zoom < 50% และโชว์เป็น tooltip; เพิ่ม autosave และข้อความ "บันทึกอัตโนมัติ 12:04" แทน beforeunload dialog ของเบราว์เซอร์ |
| ตรวจงาน / สั่งผลิต (step 4–5) | ยังไม่ได้ทดสอบจนจบ | ใช้ preflight checklist ชุดเดียวกับหลังบ้าน (Flow 2) แล้วส่งเข้า `/configure` พร้อมไฟล์แนบอัตโนมัติ — ไม่ทำ checkout ซ้ำใน studio |

## หน้าเนื้อหาและ master data

หน้ากลุ่มนี้ส่วนใหญ่ยังไม่มีข้อมูล จุดสำคัญคือ empty state ต้องสื่อว่า "กำลังมา" อย่างน่าเชื่อถือ ไม่ใช่กล่องเส้นประกาว่าง และหน้า master data หลังบ้านต้องเอารหัสภายใน (D-xxx) ออกทุกจุด

| หน้า | ปัญหาที่พบ | Spec ที่ต้องทำ |
| --- | --- | --- |
| `/styles` คลังแบบกล่อง | แสดง "0 แบบ" + empty state ทั้งที่ studio มีแบบกล่องหลายสิบแบบ (บั๊ก data source) | ดึงจาก catalogue เดียวกับ studio; การ์ด = ไอคอนแผ่นคลี่ + ชื่อ + รหัส (FEFCO) + ช่วงขนาด + 2 ปุ่ม (ออกแบบ / ดาวน์โหลดไดไลน์); filter เป็น chip แถวเดียว |
| `/samples` ชุดตัวอย่าง | empty state อย่างเดียว | หน้าขาย: การ์ดชุดตัวอย่าง (กระดาษ / งานพิมพ์ / เคลือบ) ราคา + ปุ่มใส่ตะกร้า + ข้อความ "หักคืนเมื่อสั่งผลิต"; ยังไม่มีสินค้า → แสดงการ์ด "ขอตัวอย่างเฉพาะงาน" พร้อมฟอร์มสั้นแทนปุ่มคุยกับทีม |
| `/articles`, `/learn`, `/faq`, `/help/glossary`, `/materials` | empty หรือมีเนื้อหาน้อย; หัวข้อ 56px | layout เนื้อหาเดียวกัน: หัวข้อ 38 + คำอธิบาย + หมวด chip + grid การ์ด 3 คอลัมน์ (รูป 16:9, หมวด, ชื่อ, เวลาอ่าน); ก่อนมีบทความ ซ่อนลิงก์จาก navbar/footer แทนการโชว์ empty |
| `/contact` | ยังไม่ตรวจละเอียด | 2 คอลัมน์: ซ้ายช่องทาง (LINE primary, โทร, อีเมล, เวลาทำการ) ขวาฟอร์มสั้น 4 ช่อง + หัวข้อเรื่อง (สั่งผลิต / ขอใบเสนอราคา / เป็นโรงงานพาร์ตเนอร์) |
| Admin `/catalogue` | hub การ์ด 12 ใบ คำอธิบายมี D-xxx ทุกใบ | การ์ดแสดงจำนวนรายการ ("14 ประเภท", "38 วัสดุ") และวันที่แก้ไขล่าสุด; ลบรหัส D-xxx; ปุ่ม "คำขอออกแบบโครงสร้าง" ย้ายไปมุมขวาบน |
| Admin `/marketing` | 2 ชั้น tab (แคมเปญ/โปรโมชัน/เพื่อนแนะนำ → สถานะ 6) ซ้อนกัน; หน้าชื่อ "แคมเปญ" แต่เมนูชื่อ "การตลาด" | ชั้นบนเป็น segmented control, สถานะเป็น filter chip; งบใช้ progress bar มีสีเตือนที่ 80%; ชื่อหน้าตรงกับเมนู |
| Admin `/companies` | ชื่อหน้า "บริษัท (B2B)" แต่เมนู "บริษัทคู่ค้า"; tab "กำลังตรวจเอกสาร 0" | ชื่อเดียวกัน; tab ค่า 0 ซ่อน; คอลัมน์เครดิตแสดง วงเงิน/ใช้ไป เป็น mini bar |
| Admin `/reports` | การ์ดลิงก์รายงานเป็นกลุ่ม ไม่มีตัวเลขให้เห็นเลย | แถวบน KPI 4 ตัว (ยอดขายเดือนนี้, ออเดอร์ใหม่, ส่งตรงเวลา %, ยอดค้างรับ) + sparkline; รายงานแต่ละใบมี preview ตัวเลขล่าสุดก่อนคลิก |

## ผลทดสอบ action จริงในหลังบ้าน และแผนลงมือรวมทั้งระบบ

ทดสอบ 3 action: เปิดคำขออนุมัติ, เปิด RFQ, เริ่มคำนวณราคา CS — พบช่องว่างที่สำคัญคือหน้าอนุมัติไม่มีปุ่มอนุมัติ

| ทดสอบ | ผล | ข้อสรุป |
| --- | --- | --- |
| คำขออนุมัติ "อนุมัติคำสั่งซื้อของบริษัท" ฿73,635.31 | ไม่มีปุ่มอนุมัติ/ปฏิเสธใน role CS Lead (ซ่อนโดยไม่บอก) และการ์ด "ข้อมูลที่ขออนุมัติ" โชว์ key JSON ดิบ (`amount`, `groupId`, `poNumber null`, `companyId`, `threshold`) | ต้องมี action bar: อนุมัติ (primary) / ปฏิเสธ + เหตุผล / ส่งต่อ; role ไม่มีสิทธิ์ให้แสดง "รอ ผู้อนุมัติ (ชื่อ) · เตือนอีกครั้ง"; snapshot แสดงเป็น label ไทย (ยอด, เลขกลุ่ม, บริษัท, วงเงินอนุมัติ) และซ่อน null |
| RFQ `UATRFQ-2610-00005` (รอข้อมูลเพิ่มเติม) | เปิดได้ มอบหมายได้ แต่ไม่มีทางถามลูกค้าจากหน้า tab คำขอ ต้องไป tab ข้อความ | primary action ตามสถานะ (ดู Flow 2) |
| CS คำนวณราคา กล่องลูกฟูก | ฟอร์ม 4 ส่วนในคอลัมน์เดียวยาว \~1,800px; ตัวเลือกสี 4 กล่องเป็น checkbox ทั้งที่เลือกได้อย่างเดียว; จำนวนต้องพิมพ์เองทีละค่า; แผงผลลัพธ์ขวาว่างจนกว่าจะกด | layout 7:5 เหมือน `/configure` ลูกค้า: ซ้าย stepper ย่อ/ขยายได้, ขวาผลลัพธ์ sticky อัปเดตทันที; สีเป็น radio/segmented; จำนวนมี preset 100/300/500/1,000 + เพิ่มเอง; ปุ่ม "บันทึกใบเสนอราคา" และ "สร้างคำสั่งซื้อ" ในแผงขวา |

ลำดับงานทั้งระบบ (ต่อจาก 5 ขั้นใน Flow 1):

| ลำดับ | งาน | Prompt สำหรับ Claude Code |
| --- | --- | --- |
| 6 | Approvals + RFQ + Quotations | `Approvals: detail page gets an action bar (approve primary, reject with reason, forward) gated by permission with an explicit waiting-for message when the user lacks it; render the request snapshot with Thai labels and hide nulls; list page splits into Awaiting-you cards (inline approve/reject, multi-select) and History table. RFQ: SLA countdown column with color levels, 4 tabs + filter chips, inline claim button; detail 8:4 with status-driven primary action and a 5-step RFQ timeline rail. Quotations: show document number not UUID, 6 columns, row actions resend / convert to order / PDF.` |
| 7 | Prepress proof review (admin + customer) | `Build a shared ProofReview component: left file preview over dieline with layer toggles and zoom; right preflight checklist (size, bleed 3mm, color mode, fonts outlined, >=300dpi) each pass/fail/fix with note; admin actions send-proof / request-new-file auto-composing the customer message; customer page /account/orders/[id]/proof uses the same preview with approve / request-changes and pinned comments.` |
| 8 | Production board + Shipments + Claims | `Production: 6 fixed stage columns with empty states, horizontal scroll, card drawer with QC checklist and move-stage; second view = timeline by factory. Shipments: single-line mono shipment number, single status chip, POD thumbnail and inline verify dialog (photos, qty sent/received, receiver, time) that starts the claim window. Claims: 3 tabs, due-in column, detail with side-by-side evidence vs approved proof, resolution options and cost owner.` |
| 9 | CS calculator + Studio | `CS calculator: 7:5 layout with sticky live result panel, radio/segmented for exclusive options, quantity presets, save-as-quotation and create-order buttons in the panel. Studio: full-page start screen with 4 intent cards, box picker cards with one-line descriptions and size inputs in the preview panel, 3D as a resizable floating card, right panel = inspector + always-visible price summary with blocked-reason text, autosave with timestamp instead of beforeunload.` |
| 10 | Content pages + master data + reports | `Customer content pages share one layout (38px title, chips, 3-col cards) and hide empty sections from nav; /styles reads the same catalogue as studio; /samples sells sample kits; /track shows a 5-step stepper, what-you-need-to-do card, event timeline and carrier info, accepts ?code=. Admin catalogue cards show counts and last edited, remove D-codes; marketing uses segmented control + chips and warning-colored budget bars; companies naming consistent, hide zero tabs; reports add a 4-KPI row with sparklines.` |

Mockup ทั้งหมดใน [Claude Design canvas](https://claude.ai/artifact/6fn5Lvyqa1VeY4TgfrJTUk): Homepage · Sign in ×2 · Products · Product detail · Configure · Admin dashboard · Admin order · Admin RFQ detail · Admin approvals · Proof review · Claim detail · Track (customer) · Studio start
