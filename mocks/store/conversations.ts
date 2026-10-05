/**
 * Conversations v2 (U5.B2, D-300), mocked once for both sides: the customer's threads at
 * `store.conversations.*` and the CS inbox at `admin.conversations.*` read the same rows, so a
 * message sent from the storefront is in the inbox, and a staff reply is in the customer's thread.
 *
 * One live thread per customer × subject; internal notes never reach the customer; reading moves
 * the reader's position (read receipts). The first-response clock is a fixed day in the mock
 * (`support.first_response_business_days` = 1, D-221). Nothing is sent anywhere.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { orders } from "../admin/commerce";
import { personaByKey, type StaffPersona } from "../personas";
import { bangkokIso, mockId, principalOf, problem } from "../support";
import { customerOf, type MockCustomer } from "./customers";
import { ownerIdOf } from "./owner";

type Message = Schemas["MessageDto"];
type Subject = Schemas["ConversationSubject"];

export interface Thread {
  id: string;
  /** The storefront customer (`MockCustomer.id`) and the commerce owner whose records it may cite. */
  customerId: string;
  ownerId: string;
  customerName: string;
  subjectType: Subject;
  subject: Schemas["SubjectRefDto"] | null;
  status: Schemas["ConversationStatus"];
  channel: Schemas["ConversationChannel"];
  replyChannel: Schemas["ReplyChannel"];
  replyChannelChosen: boolean;
  assignee: Schemas["UserRefDto"] | null;
  messages: Message[];
  customerReadAt: string | null;
  staffReadAt: string | null;
  firstResponseDueAt: string | null;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
}

const DAY = 24 * 60;
let seq = 0;
const nextId = () => mockId("c0nv", ++seq);
export const threads: Thread[] = [];

const CANNED: Schemas["CannedResponseDto"][] = [
  canned(1, "ทักทาย", "สวัสดีค่ะ ทีม Packio ยินดีช่วยค่ะ ขอดูรายละเอียดสักครู่นะคะ", "Hello, this is the Packio team — give us a moment to check the details."),
  canned(2, "สถานะการผลิต", "คำสั่งซื้อของคุณอยู่ระหว่างผลิตตามแผนค่ะ จะแจ้งทันทีเมื่อจัดส่ง", "Your order is in production on schedule; we will tell you as soon as it ships."),
  canned(3, "ขอไฟล์งานเพิ่ม", "รบกวนส่งไฟล์งานเป็น PDF หรือ AI พร้อมระยะตัดตก 3 มม. ได้เลยค่ะ", "Please send the artwork as PDF or AI with a 3 mm bleed."),
];

function canned(n: number, title: string, bodyTh: string, bodyEn: string): Schemas["CannedResponseDto"] {
  return {
    id: mockId("c4nd", n),
    title,
    bodyTh,
    bodyEn,
    tags: [],
    archived: false,
    updatedBy: { id: mockId("5taf", 7), displayName: "หัวหน้าบริการลูกค้า (ข้อมูลจำลอง)" },
    updatedAt: "2026-10-01T09:00:00+07:00",
  };
}

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = () => problem(404, "http.not_found", "ไม่พบบทสนทนานี้");

function message(
  direction: Message["direction"],
  sender: Schemas["UserRefDto"] | null,
  input: { body?: string | null; contextCard?: Message["contextCard"]; file?: Message["file"] },
  visibility: Message["visibility"] = "customer",
  via: Message["via"] = "web",
): Message {
  return {
    id: nextId(),
    direction,
    kind: input.file ? (input.file.mimeType.startsWith("image/") ? "image" : "file") : "text",
    body: input.body ?? null,
    sender,
    sentAt: bangkokIso(),
    readAt: null,
    visibility,
    via,
    contextCard: input.contextCard ?? null,
    file: input.file ?? null,
  };
}

/** A card to one of the customer's own records — an order by its code, otherwise the id as its label. */
function cardOf(thread: Pick<Thread, "ownerId">, input: Schemas["ContextCardInputDto"] | undefined) {
  if (!input) return { card: null as Message["contextCard"], refused: false };
  if (input.type === "order") {
    const order = orders.find((row) => row.id === input.id && row.customer.id === thread.ownerId);
    if (!order) return { card: null, refused: true };
    return { card: { type: input.type, id: input.id, label: order.orderCode, status: order.status }, refused: false };
  }
  return { card: { type: input.type, id: input.id, label: input.id.slice(0, 8).toUpperCase(), status: null }, refused: false };
}

function subjectOf(ownerId: string, type: Subject, id: string | undefined): Schemas["SubjectRefDto"] | null | "refused" {
  if (type === "support") return null;
  if (!id) return "refused";
  if (type === "order") {
    const order = orders.find((row) => row.id === id && row.customer.id === ownerId);
    return order ? { type, id, label: order.orderCode } : "refused";
  }
  return { type: type as Schemas["ConversationRecordSubject"], id, label: id.slice(0, 8).toUpperCase() };
}

const fileOf = (fileId: string): Message["file"] => ({
  id: fileId,
  name: `ไฟล์แนบ-${fileId.slice(-4)}.png`,
  mimeType: "image/png",
});

const unread = (thread: Thread) =>
  thread.messages.filter(
    (m) => m.direction === "outbound" && m.visibility === "customer" && (!thread.customerReadAt || m.sentAt > thread.customerReadAt),
  ).length;

const visible = (thread: Thread) => thread.messages.filter((m) => m.visibility === "customer");

export function storeThreadDto(thread: Thread): Schemas["StoreThreadDto"] {
  const last = visible(thread).at(-1);
  return {
    id: thread.id,
    status: thread.status,
    subjectType: thread.subjectType,
    subject: thread.subject,
    lastMessageAt: last?.sentAt ?? bangkokIso(),
    lastMessage: last?.body ?? last?.file?.name ?? null,
    unread: unread(thread),
    replyChannel: thread.replyChannel,
    replyChannelChosen: thread.replyChannelChosen,
    readByPackioAt: thread.staffReadAt,
  };
}

function slaOf(thread: Thread): Schemas["ConversationSlaDto"] {
  const overdue = thread.firstResponseDueAt !== null && thread.firstRespondedAt === null && thread.firstResponseDueAt < bangkokIso();
  return {
    state: thread.firstRespondedAt ? "answered" : overdue ? "overdue" : "waiting",
    firstResponseDueAt: thread.firstResponseDueAt,
    firstRespondedAt: thread.firstRespondedAt,
    resolutionDueAt: null,
    resolvedAt: thread.resolvedAt,
  };
}

export function adminThreadDto(thread: Thread): Schemas["ConversationDto"] {
  const last = thread.messages.at(-1);
  return {
    id: thread.id,
    status: thread.status,
    lastMessageAt: last?.sentAt ?? bangkokIso(),
    channel: thread.channel,
    customer: { id: thread.customerId, displayName: thread.customerName },
    lineDisplayName: null,
    lineFriendStatus: "unknown",
    assignee: thread.assignee,
    lastMessage: last?.body ?? last?.file?.name ?? null,
    ticket: null,
    subjectType: thread.subjectType,
    subject: thread.subject,
    company: null,
    replyChannel: thread.replyChannel,
    sla: slaOf(thread),
    participants: [
      { user: { id: thread.customerId, displayName: thread.customerName }, role: "customer", lastReadAt: thread.customerReadAt },
      ...(thread.assignee ? [{ user: thread.assignee, role: "staff" as const, lastReadAt: thread.staffReadAt }] : []),
    ],
    mergedIntoId: null,
  };
}

/** The customer's message: the first one waiting for an answer starts the first-response clock. */
function customerSays(thread: Thread, sent: Message[]) {
  thread.messages.push(...sent);
  if (thread.status === "closed") thread.status = "open";
  if (thread.firstResponseDueAt === null) thread.firstResponseDueAt = bangkokIso(DAY);
}

function composed(
  thread: Thread,
  body: { body?: string; fileIds?: string[]; contextCard?: Schemas["ContextCardInputDto"] },
  direction: Message["direction"],
  sender: Schemas["UserRefDto"] | null,
): Message[] | Response {
  const text = body.body?.trim();
  const { card, refused } = cardOf(thread, body.contextCard);
  if (refused) return problem(422, "validation.failed", "อ้างถึงรายการที่ไม่ใช่ของคุณไม่ได้", [{ path: "contextCard.id", code: "not_found", message: "not found" }]);
  const files = body.fileIds ?? [];
  if (!text && !card && files.length === 0)
    return problem(422, "validation.failed", "พิมพ์ข้อความ แนบไฟล์ หรือแนบการ์ดอย่างน้อยหนึ่งอย่าง", [
      { path: "body", code: "required", message: "required" },
    ]);
  const sent: Message[] = [];
  if (text || card) sent.push(message(direction, sender, { body: text ?? null, contextCard: card }));
  for (const fileId of files) sent.push(message(direction, sender, { file: fileOf(fileId) }));
  return sent;
}

function threadOfCustomer(customer: MockCustomer, id: string) {
  return threads.find((thread) => thread.id === id && thread.customerId === customer.id);
}

/** Seeds one answered support thread for a persona the first time it looks, so the list is never empty in demos. */
function seedFor(customer: MockCustomer) {
  if (customer.persona !== "returning" || threads.some((t) => t.customerId === customer.id)) return;
  const cs = { id: mockId("5taf", 6), displayName: "สมชาย ตัวอย่าง (ข้อมูลจำลอง)" };
  const thread: Thread = {
    id: nextId(),
    customerId: customer.id,
    ownerId: ownerIdOf(customer),
    customerName: customer.displayName,
    subjectType: "support",
    subject: null,
    status: "pending",
    channel: "web",
    replyChannel: "web",
    replyChannelChosen: false,
    assignee: cs,
    messages: [],
    customerReadAt: null,
    staffReadAt: null,
    firstResponseDueAt: null,
    firstRespondedAt: null,
    resolvedAt: null,
  };
  const ask = message("inbound", null, { body: "สอบถามว่ากล่องลูกฟูกพิมพ์ 2 สีได้ไหมคะ" });
  ask.sentAt = "2026-10-02T10:00:00+07:00";
  const answer = message("outbound", cs, { body: "ได้ค่ะ พิมพ์ได้สูงสุด 4 สี เลือกได้ในหน้ากำหนดสเปกเลยค่ะ" });
  answer.sentAt = "2026-10-02T10:20:00+07:00";
  thread.messages.push(ask, answer);
  thread.firstResponseDueAt = "2026-10-03T10:00:00+07:00";
  thread.firstRespondedAt = answer.sentAt;
  thread.staffReadAt = ask.sentAt;
  threads.push(thread);
}

function staffOf(request: Request): StaffPersona | null {
  const principal = principalOf(request);
  if (principal?.audience !== "staff") return null;
  return personaByKey(principal.persona ?? "cs") ?? null;
}

const staffRef = (persona: StaffPersona): Schemas["UserRefDto"] => ({ id: persona.id, displayName: persona.displayName });

const page = (rows: Message[], url: URL) => {
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const start = Number(url.searchParams.get("cursor") ?? 0);
  const newestFirst = [...rows].reverse();
  const slice = newestFirst.slice(start, start + limit);
  return { data: slice, meta: { nextCursor: start + limit < newestFirst.length ? String(start + limit) : null } };
};

export const storeConversationHandlers = [
  http.get("*/v1/store/conversations", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    seedFor(customer);
    const mine = threads
      .filter((thread) => thread.customerId === customer.id)
      .map(storeThreadDto)
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    return HttpResponse.json(mine.slice(0, 100));
  }),

  http.post("*/v1/store/conversations", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const body = (await request.json()) as Schemas["OpenThreadDto"];
    const ownerId = ownerIdOf(customer);
    const subject = subjectOf(ownerId, body.subjectType, body.subjectId);
    if (subject === "refused")
      return problem(422, "validation.failed", "อ้างถึงรายการที่ไม่ใช่ของคุณไม่ได้", [{ path: "subjectId", code: "not_found", message: "not found" }]);
    let thread = threads.find(
      (row) =>
        row.customerId === customer.id &&
        row.subjectType === body.subjectType &&
        (row.subject?.id ?? null) === (subject?.id ?? null) &&
        row.status !== "closed",
    );
    const created = !thread;
    thread ??= {
      id: nextId(),
      customerId: customer.id,
      ownerId,
      customerName: customer.displayName,
      subjectType: body.subjectType,
      subject,
      status: "open",
      channel: "web",
      replyChannel: "web",
      replyChannelChosen: false,
      assignee: null,
      messages: [],
      customerReadAt: null,
      staffReadAt: null,
      firstResponseDueAt: null,
      firstRespondedAt: null,
      resolvedAt: null,
    };
    const sent = composed(thread, body, "inbound", null);
    if (sent instanceof Response) return sent;
    if (created) threads.push(thread);
    customerSays(thread, sent);
    return HttpResponse.json({ conversationId: thread.id, messages: sent } satisfies Schemas["SentDto"], { status: 201 });
  }),

  http.get("*/v1/store/conversations/:conversationId", ({ request, params }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const thread = threadOfCustomer(customer, String(params.conversationId));
    return thread ? HttpResponse.json(storeThreadDto(thread)) : notFound();
  }),

  http.get("*/v1/store/conversations/:conversationId/messages", ({ request, params }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const thread = threadOfCustomer(customer, String(params.conversationId));
    if (!thread) return notFound();
    const now = bangkokIso();
    // Reading moves my read position; Packio sees it as a read receipt on its own messages.
    thread.customerReadAt = now;
    for (const m of thread.messages) if (m.direction === "outbound" && m.readAt === null) m.readAt = now;
    return HttpResponse.json(page(visible(thread), new URL(request.url)));
  }),

  http.post("*/v1/store/conversations/:conversationId/messages", async ({ request, params }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const thread = threadOfCustomer(customer, String(params.conversationId));
    if (!thread) return notFound();
    const sent = composed(thread, (await request.json()) as Schemas["PostMessageDto"], "inbound", null);
    if (sent instanceof Response) return sent;
    customerSays(thread, sent);
    return HttpResponse.json({ conversationId: thread.id, messages: sent } satisfies Schemas["SentDto"], { status: 201 });
  }),

  http.put("*/v1/store/conversations/:conversationId/reply-channel", async ({ request, params }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const thread = threadOfCustomer(customer, String(params.conversationId));
    if (!thread) return notFound();
    const { replyChannel } = (await request.json()) as Schemas["ReplyChannelDto"];
    // LINE needs a linked LINE account (D-300); the mock personas have none.
    if (replyChannel === "line" && !customer.identities.some((identity) => identity.provider === "line"))
      return problem(422, "conversations.unreachable", "บัญชีนี้ยังไม่ได้เชื่อมกับ LINE");
    thread.replyChannel = replyChannel;
    thread.replyChannelChosen = true;
    return HttpResponse.json(storeThreadDto(thread));
  }),
];

const forbidden = () => problem(403, "auth.forbidden", "ไม่มีสิทธิ์ทำรายการนี้");

function staffThread(request: Request, id: string, permission = "conversations.read") {
  const persona = staffOf(request);
  if (!persona) return { error: unauthenticated() } as const;
  if (!persona.permissions.includes(permission as never)) return { error: forbidden() } as const;
  const thread = threads.find((row) => row.id === id);
  return thread ? ({ persona, thread } as const) : ({ error: notFound() } as const);
}

export const adminConversationHandlers = [
  http.get("*/v1/admin/conversations/stats", ({ request }) => {
    const persona = staffOf(request);
    if (!persona) return unauthenticated();
    const answered = threads.filter((t) => t.firstRespondedAt);
    return HttpResponse.json({
      from: "2026-09-28",
      to: "2026-10-05",
      opened: threads.length,
      closed: threads.filter((t) => t.status === "closed").length,
      firstResponse: { count: answered.length, medianMinutes: answered.length ? "20" : null, p90Minutes: answered.length ? "45" : null, withinTargetPct: answered.length ? "100" : null },
      resolution: { count: 0, medianMinutes: null, p90Minutes: null },
      overdueNow: threads.filter((t) => slaOf(t).state === "overdue").length,
    } satisfies Schemas["ConversationStatsDto"]);
  }),

  http.get("*/v1/admin/conversations", ({ request }) => {
    const persona = staffOf(request);
    if (!persona) return unauthenticated();
    if (!persona.permissions.includes("conversations.read" as never)) return forbidden();
    const url = new URL(request.url);
    const q = url.searchParams;
    let rows = threads.map(adminThreadDto);
    if (q.get("status")) rows = rows.filter((r) => r.status === q.get("status"));
    if (q.get("subjectType")) rows = rows.filter((r) => r.subjectType === q.get("subjectType"));
    if (q.get("sla")) rows = rows.filter((r) => r.sla.state === q.get("sla"));
    if (q.get("assigned") === "me") rows = rows.filter((r) => r.assignee?.id === persona.id);
    if (q.get("assigned") === "unassigned") rows = rows.filter((r) => r.assignee === null);
    const text = q.get("q")?.trim();
    if (text) rows = rows.filter((r) => r.customer?.displayName.includes(text));
    rows.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    const perPage = Number(q.get("perPage") ?? 25);
    const pageNo = Number(q.get("page") ?? 1);
    return HttpResponse.json({
      data: rows.slice((pageNo - 1) * perPage, pageNo * perPage),
      meta: { page: pageNo, perPage, total: rows.length},
    });
  }),

  http.get("*/v1/admin/conversations/:conversationId", ({ request, params }) => {
    const found = staffThread(request, String(params.conversationId));
    return "error" in found ? found.error : HttpResponse.json(adminThreadDto(found.thread));
  }),

  http.get("*/v1/admin/conversations/:conversationId/messages", ({ request, params }) => {
    const found = staffThread(request, String(params.conversationId));
    if ("error" in found) return found.error;
    return HttpResponse.json(page(found.thread.messages, new URL(request.url)));
  }),

  http.post("*/v1/admin/conversations/:conversationId/actions/mark-read", ({ request, params }) => {
    const found = staffThread(request, String(params.conversationId));
    if ("error" in found) return found.error;
    const now = bangkokIso();
    found.thread.staffReadAt = now;
    for (const m of found.thread.messages) if (m.direction === "inbound" && m.readAt === null) m.readAt = now;
    return HttpResponse.json(adminThreadDto(found.thread));
  }),

  http.post("*/v1/admin/conversations/:conversationId/actions/assign", async ({ request, params }) => {
    const found = staffThread(request, String(params.conversationId), "conversations.reply");
    if ("error" in found) return found.error;
    const { userId } = (await request.json().catch(() => ({}))) as Schemas["AssignConversationDto"];
    const target = userId ? personaByKeyId(userId) : found.persona;
    found.thread.assignee = target ? staffRef(target) : null;
    return HttpResponse.json(adminThreadDto(found.thread));
  }),

  http.post("*/v1/admin/conversations/:conversationId/actions/close", ({ request, params }) => {
    const found = staffThread(request, String(params.conversationId), "conversations.reply");
    if ("error" in found) return found.error;
    if (found.thread.status === "closed") return problem(409, "conversations.closed", "บทสนทนานี้ปิดแล้ว");
    found.thread.status = "closed";
    found.thread.resolvedAt = bangkokIso();
    return HttpResponse.json(adminThreadDto(found.thread));
  }),

  http.post("*/v1/admin/conversations/:conversationId/messages", async ({ request, params }) => {
    const found = staffThread(request, String(params.conversationId), "conversations.reply");
    if ("error" in found) return found.error;
    const body = (await request.json()) as Schemas["StaffReplyDto"];
    const template = body.cannedResponseId ? CANNED.find((c) => c.id === body.cannedResponseId) : undefined;
    const sent = composed(found.thread, { ...body, body: body.body ?? template?.bodyTh }, "outbound", staffRef(found.persona));
    if (sent instanceof Response) return sent;
    const { thread } = found;
    thread.messages.push(...sent);
    thread.firstRespondedAt ??= sent[0]!.sentAt;
    thread.assignee ??= staffRef(found.persona);
    thread.status = "pending";
    return HttpResponse.json(sent[0], { status: 201 });
  }),

  http.post("*/v1/admin/conversations/:conversationId/notes", async ({ request, params }) => {
    const found = staffThread(request, String(params.conversationId), "conversations.reply");
    if ("error" in found) return found.error;
    const body = (await request.json()) as Schemas["ConversationNoteDto"];
    if (!body.body?.trim())
      return problem(422, "validation.failed", "พิมพ์บันทึกก่อน", [{ path: "body", code: "required", message: "required" }]);
    const note = message("outbound", staffRef(found.persona), { body: body.body.trim() }, "internal");
    found.thread.messages.push(note);
    return HttpResponse.json(note, { status: 201 });
  }),

  http.get("*/v1/admin/canned-responses", ({ request }) => {
    const persona = staffOf(request);
    if (!persona) return unauthenticated();
    const rows = CANNED.filter((c) => !c.archived);
    return HttpResponse.json({ data: rows, meta: { page: 1, perPage: 100, total: rows.length} });
  }),
];

function personaByKeyId(userId: string): StaffPersona | undefined {
  for (const key of ["cs", "cs_lead", "admin", "superadmin"]) {
    const persona = personaByKey(key);
    if (persona?.id === userId) return persona;
  }
  return undefined;
}
