# Prompt pack v3 — packio-web (frontend)

**Packio — Your Packaging Production Partner** · Collective Group (Thailand)

## ลำดับการรัน และข้อความ kickoff (วางใน Plan Mode ทีละ session แล้ว `/clear` ก่อน session ถัดไป)
คำนำหน้ามาตรฐาน (ใช้ทุก session): `Read CLAUDE.md, docs/prompts/00-master-plan.md, docs/decisions.md and docs/prompts/design-system.md.`

| Step | Kickoff (ต่อท้ายคำนำหน้ามาตรฐาน) |
|---|---|
| F0.1 | `Then read docs/prompts/F0-setup.md. Do Session 0.1 only. Plan first.` |
| F0.2 | `Then read docs/prompts/F0-setup.md. Do Session 0.2 only. Plan first.` |
| F1.1–1.3 | `Then read docs/contract/api-conventions.md and docs/prompts/F1-foundation.md. Do Deliverable 1.N only. Plan first.` |
| F2.1–2.8 | `Then read docs/contract/api-conventions.md and docs/prompts/F2-admin.md. Do Deliverable 2.N only. Plan first.` |
| F3.1–3.7 | `Then read docs/contract/api-conventions.md and docs/prompts/F3-storefront.md. Do Phase 3.N only. Plan first.` |
| F4 A–E | `Then read docs/prompts/F4-designer.md. Do Part X only. Plan first.` |
| F5.1–5.3 | `Then read docs/contract/api-conventions.md and docs/prompts/F5-partner.md. Do session 5.N only. Plan first.` |
| F6.1–6.4 | `Then read docs/contract/api-conventions.md, docs/accounting-design.md and docs/prompts/F6-finance.md. Do Deliverable 6.N only. Plan first.` |

หลัง F1 เสร็จ F2–F6 รันขนานกันได้ใน git worktree แยก (`git worktree add ../packio-web-f3 -b feat/f3`) ใช้ MSW mock จนกว่า backend ของส่วนนั้นเสร็จ
แนะนำให้ทำ F4 Part A (engine + publish `@packio/dieline`) เร็ว เพราะ configurator 3D (F3.2) และ drawing service ของ backend (B4.1) ต้องใช้

## ประสานงานกับ backend
- backend commit contract ใหม่ → bump `contract.lock.json` → `pnpm gen:api` → แก้ type error ที่เกิดขึ้น
- endpoint ที่ยังไม่มี → เขียนใน `docs/contract-requests.md` แล้วส่งให้ฝั่ง backend

## Update U1 (2026-09-29) — สำหรับ repo ที่รัน F0–F6 ครบแล้ว
คำนำหน้ามาตรฐานเหมือนเดิม แล้วต่อท้ายด้วยคำสั่งของแต่ละ session (Plan Mode, `/clear` ระหว่าง session)

| Session | Kickoff (ต่อท้ายคำนำหน้ามาตรฐาน) | รอ backend |
|---|---|---|
| U-F0.1 | `Then read docs/contract/api-conventions.md and docs/prompts/U1-update-2026-09-29.md. Do session U-F0.1 only, starting with the gap analysis. Plan first.` | U-B0 ขั้น 1 (tag release) + triage |
| U-F0.2–0.4 | `Then read docs/prompts/U1-update-2026-09-29.md. Do session U-F0.N only (N=2 customer, 3 admin, 4 partner). Plan first.` | U-B0.1–0.3 ของ zone นั้น |
| U-F0.5 | `Then read docs/prompts/U1-update-2026-09-29.md. Do session U-F0.5 only. Plan first.` | U-B0 ครบ |
| U-F2 | `Then read docs/prompts/U1-update-2026-09-29.md. Do session U-F2 only, starting with the gap analysis. Plan first.` | ไม่ต้องรอ (ทำขนานได้) |
| U-F3 | `Then read docs/prompts/F3-storefront.md and docs/prompts/U1-update-2026-09-29.md. Do session U-F3 only. Plan first.` | U-B4 (เริ่มบน mock ได้) |
| U-F4 | `Then read docs/prompts/F2-admin.md, docs/prompts/F5-partner.md and docs/prompts/U1-update-2026-09-29.md. Do session U-F4 only. Plan first.` | U-B3 |
