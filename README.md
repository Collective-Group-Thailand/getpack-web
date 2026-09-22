# Packio prompt pack v2 — แยก frontend / backend

**Packio — Your Packaging Production Partner** · by Collective Group (Thailand)

| โฟลเดอร์ | วางที่ | คืออะไร |
|---|---|---|
| `backend/` | root ของ repo ใหม่ `packio-api` | NestJS 12 · PostgreSQL 18 + pgvector · ETL จาก Locopack · B1–B4 |
| `frontend/` | root ของ repo เดิม (BoxStudio) ที่จะกลายเป็น `packio-web` | Next.js 16 app เดียว: customer + admin + partner zone · F0–F5 |

ไฟล์ `docs/contract/api-conventions.md` เหมือนกันทั้งสองฝั่ง — แก้ต้องแก้คู่กันเสมอ
ไฟล์ `docs/legacy/*` ถูกแก้ข้อขัดแย้งแล้ว (§1 เดิมบอกให้ API compatible กับเว็บ SME เดิม ซึ่งขัดกับ ADR-0002)

## ลำดับเริ่มงานที่แนะนำ
1. Frontend **F0** (restructure repo เดิม) และ Backend **B1.1** เริ่มพร้อมกันได้
2. Backend B1.2 จะหยุดให้รีวิว `docs/schema-design.md` ก่อนเขียน migration — จุดนี้สำคัญที่สุดของทั้งโปรเจกต์
3. Frontend F1 ใช้ mock จาก contract ได้ระหว่างที่ backend ทำ B1.2–B1.4
4. จากนั้นเดินคู่: B2.x ↔ F2.x / F3.x ตาม module

ดูรายละเอียดใน `backend/docs/prompts/README.md` และ `frontend/docs/prompts/README.md`
