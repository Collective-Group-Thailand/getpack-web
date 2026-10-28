/**
 * C1f (owner 2026-10-28 13:58, D-451, DECISIONS-STAGE-A §14.7): `admin.customerFileAccessLogs.list` as getpack-api
 * answers it — newest first, cursor pages, the filters of the back-office page (period, actor, order code, file, kind,
 * Superadmin access with a typed reason). Every row is obviously fake (mock data, never shown in production).
 */

import { http, HttpResponse, type HttpHandler } from "msw";

import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can, PERSONAS } from "../personas";
import { bangkokIso, mockId, problem } from "../support";

type Entry = Schemas["FileAccessLogEntryDto"];

const staff = (key: string) => {
  const persona = PERSONAS.find((p) => p.key === key)!;
  return { type: "user" as const, id: persona.id, name: persona.displayName };
};

const order = (n: number) => ({ id: mockId("ord", n), orderCode: `DEVOR-2610-${String(n).padStart(5, "0")}` });

/** A handful of accesses over the last days: Prepress downloads, a thumbnail, and two Superadmin reason accesses. */
export const fileAccessLog: Entry[] = [
  {
    id: mockId("fal", 6),
    occurredAt: bangkokIso(-30),
    actor: staff("superadmin"),
    fileId: mockId("file", 1014),
    fileKind: "customer_original",
    order: order(1),
    channel: "admin",
    purpose: "download",
    reason: "ตรวจไฟล์ต้นฉบับตามคำขอลูกค้า (ข้อมูลจำลอง)",
    requestId: "req-mock-0006",
  },
  {
    id: mockId("fal", 5),
    occurredAt: bangkokIso(-180),
    actor: staff("prepress"),
    fileId: mockId("file", 1014),
    fileKind: "customer_original",
    order: order(1),
    channel: "admin",
    purpose: "download",
    reason: null,
    requestId: "req-mock-0005",
  },
  {
    id: mockId("fal", 4),
    occurredAt: bangkokIso(-60 * 26),
    actor: staff("prepress"),
    fileId: mockId("file", 1015),
    fileKind: "production_copy",
    order: order(2),
    channel: "admin",
    purpose: "thumbnail",
    reason: null,
    requestId: "req-mock-0004",
  },
  {
    id: mockId("fal", 3),
    occurredAt: bangkokIso(-60 * 50),
    actor: staff("superadmin"),
    fileId: mockId("file", 1016),
    fileKind: "approved_proof_copy",
    order: order(3),
    channel: "admin",
    purpose: "download",
    reason: "ตรวจสอบข้อร้องเรียนเรื่องสีงานพิมพ์ (ข้อมูลจำลอง)",
    requestId: "req-mock-0003",
  },
  {
    id: mockId("fal", 2),
    occurredAt: bangkokIso(-60 * 75),
    actor: { type: "api_client", id: mockId("cli", 1), name: "ระบบพาร์ทเนอร์ทดสอบ (ข้อมูลจำลอง)" },
    fileId: mockId("file", 1015),
    fileKind: "production_copy",
    order: order(2),
    channel: "partner",
    purpose: "download",
    reason: null,
    requestId: "req-mock-0002",
  },
];

/** The page's filters as the API applies them (shared with the list export mock). */
export function filterFileAccessLog(get: (name: string) => string | null): Entry[] {
  const from = get("from") ? Date.parse(get("from")!) : -Infinity;
  const to = get("to") ? Date.parse(get("to")!) : Infinity;
  const withReason = get("withReason");
  return fileAccessLog.filter(
    (e) =>
      (!get("orderCode") || e.order?.orderCode.toLowerCase() === get("orderCode")!.toLowerCase()) &&
      (!get("orderId") || e.order?.id === get("orderId")) &&
      (!get("fileId") || e.fileId === get("fileId")) &&
      (!get("userId") || e.actor.id === get("userId")) &&
      (!get("fileKind") || e.fileKind === get("fileKind")) &&
      (withReason === null || (withReason === "true") === (e.reason !== null)) &&
      Date.parse(e.occurredAt) >= from &&
      Date.parse(e.occurredAt) < to,
  );
}

export const fileAccessLogHandlers: HttpHandler[] = [
  http.get("*/v1/admin/customer-file-access-logs", ({ request }) => {
    if (!can(staffPersonaOf(request), "customer_file_access_logs.read"))
      return problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ดูบันทึกนี้");
    const url = new URL(request.url);
    const rows = filterFileAccessLog((name) => url.searchParams.get(name));
    const start = Number(url.searchParams.get("cursor") ?? 0);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
    const next = start + limit < rows.length ? String(start + limit) : null;
    return HttpResponse.json({ data: rows.slice(start, start + limit), meta: { nextCursor: next } });
  }),
];
