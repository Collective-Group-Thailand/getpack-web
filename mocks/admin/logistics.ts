/**
 * Claims on the published contract (`admin.claims.*`, `admin.files.download` for their photos,
 * U-F0.3). Claims follow the D-082 window and D-083 rules. The shipments live in `./shipments.ts`
 * (U-F0.4) and are re-exported here for the modules that read them beside the claims.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { nextActions, type ActionRule } from "../next-actions";
import { can, type StaffPersona } from "../personas";
import { bangkokIso, matchesQuery, mockId, paginate, problem } from "../support";
import { baht, FACTORY, orders } from "./commerce";
import { registerQueue } from "./console";
import type { ClaimDetail } from "./logistics-model";
import { etagOf } from "./tables";

export { shipments, type Shipment } from "./shipments";
export type Claim = ClaimDetail & { updatedAt: string };

const DAY = 24 * 60;
const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const photo = (n: number, name: string) => ({
  id: mockId("fil", 8000 + n),
  originalName: name,
  mimeType: "image/jpeg",
  sizeBytes: 240_000,
  thumbnailUrl: `https://files.example.invalid/thumb/${name}`,
  url: `https://files.example.invalid/${name}`,
});
const ref = (who: StaffPersona) => ({ id: who.id, displayName: who.displayName });
const orderOf = (index: number) => orders[index % orders.length]!;
const factoryOf = (order: (typeof orders)[number]) => order.jobs[0]?.factory ?? FACTORY;

/* ----------------------------------------------------------------------------------- claims */

/** The D-083 rule key behind each type's liability (damage: the factory shipped, as `RULES` says). */
const RULE_KEYS: Record<Claim["type"], Schemas["ClaimLiabilityRule"]> = {
  damaged: "factory_fleet_transit",
  wrong_spec: "factory_production",
  print_defect: "factory_production",
  quantity_short: "factory_short_delivery",
  late: "staff_decides",
  other: "staff_decides",
};

const RULES: Record<Claim["type"], [Claim["liability"], string]> = {
  damaged: ["factory", "สินค้าเสียหายระหว่างขนส่ง โรงงานเป็นผู้ส่ง (D-083)"],
  wrong_spec: ["factory", "ผลิตผิดสเปก (D-083)"],
  print_defect: ["factory", "ข้อบกพร่องงานพิมพ์ (D-083)"],
  quantity_short: ["factory", "จำนวนขาดเกินค่าเผื่อ (D-080)"],
  late: ["undetermined", "ส่งล่าช้า ต้องพิจารณาสาเหตุ"],
  other: ["undetermined", "ต้องพิจารณาเป็นกรณี"],
};

function claim(
  n: number,
  order: (typeof orders)[number],
  type: Claim["type"],
  status: Claim["status"],
  origin: Claim["origin"] = "customer",
  extra: Partial<Claim> = {},
): Claim {
  const [liability, rule] = RULES[type];
  return {
    id: mockId("clm", n),
    claimNo: `CL-2569-${String(40 + n).padStart(5, "0")}`,
    type,
    origin,
    status,
    order: { id: order.id, orderCode: order.orderCode },
    customer: order.customer,
    factory: factoryOf(order),
    requestedResolution: type === "quantity_short" ? "partial_refund" : type === "late" ? "credit" : "reprint",
    claimedAmount: type === "quantity_short" ? baht(420000) : null,
    liability,
    submittedAt: bangkokIso(-DAY * 2 + n * 60),
    slaDueAt: ["submitted", "under_review", "need_info", "factory_review"].includes(status)
      ? bangkokIso(DAY - n * 90)
      : null,
    shipment: order.shipments[0] ? { id: order.shipments[0].id, shipmentNo: order.shipments[0].shipmentNo } : null,
    description:
      type === "damaged"
        ? "กล่องบุบหลายใบ ฝากล่องฉีก (ข้อมูลจำลอง)"
        : type === "print_defect"
          ? "สีโลโก้เพี้ยนจากปรู๊ฟที่อนุมัติ (ข้อมูลจำลอง)"
          : type === "quantity_short"
            ? "นับได้น้อยกว่าที่สั่ง (ข้อมูลจำลอง)"
            : "ส่งช้ากว่ากำหนด 3 วัน (ข้อมูลจำลอง)",
    receivedAt: bangkokIso(-DAY * 4),
    windowEndsAt: bangkokIso(DAY * 3),
    claimedQuantity: type === "quantity_short" ? Math.round(order.quantity * 0.08) : null,
    evidence: {
      productPhotos: origin === "customer" ? [photo(500 + n * 2, `product-${n}.jpg`)] : [],
      cartonPhotos: origin === "customer" ? [photo(501 + n * 2, `carton-${n}.jpg`)] : [],
    },
    liabilityByRule: liability,
    liabilityRule: rule,
    liabilityOverride: null,
    approvedProof:
      type === "print_defect" ? { id: mockId("prf", n), versionNo: 2, approvedAt: bangkokIso(-DAY * 20) } : null,
    factoryResponse: status === "factory_review" ? null : null,
    decision: null,
    resolutions: [],
    messages: [
      {
        at: bangkokIso(-DAY * 2),
        author: order.customer.displayName,
        audience: "customer",
        body: "ขอให้ช่วยตรวจสอบด้วยครับ",
      },
    ],
    allowedActions: [],
    allowedResolutions: [],
    updatedAt: bangkokIso(-DAY),
    ...extra,
  };
}

const completed = orders.filter((order) => order.status === "completed");
/** Every claim; the partner zone shows a factory the ones that name it (`mocks/partner/billing.ts`). */
export const claims: Claim[] = [
  claim(1, completed[0] ?? orderOf(0), "damaged", "under_review"),
  claim(2, completed[1] ?? orderOf(1), "print_defect", "submitted"),
  claim(3, completed[2] ?? orderOf(2), "quantity_short", "under_review", "tolerance_auto"),
  claim(4, completed[3] ?? orderOf(3), "late", "need_info"),
  claim(5, completed[4] ?? orderOf(4), "wrong_spec", "approved"),
  claim(6, completed[0] ?? orderOf(5), "damaged", "factory_review"),
];

registerQueue("claims.read", () => {
  const open = claims.filter((item) =>
    ["submitted", "under_review", "need_info", "factory_review"].includes(item.status),
  );
  return {
    key: "claims.open",
    path: "/admin/claims",
    count: open.length,
    overdueCount: open.filter((item) => item.slaDueAt && Date.parse(item.slaDueAt) < Date.now()).length,
    nextDueAt:
      open
        .map((item) => item.slaDueAt)
        .filter(Boolean)
        .sort()[0] ?? null,
  };
});

/* ------------------------------------------------------------------ the storefront's side */

export type LogisticsClaim = Claim;
type FileRef = Claim["evidence"]["productPhotos"][number];

/** One claim row, as the storefront's claims mock (F3 3.6) reads it. */
export function claimRow(claimId: string): Claim | undefined {
  return claims.find((candidate) => candidate.id === claimId);
}

/** A claim the commerce seed lists on an order but the desk never built — built on first read. */
export function adoptClaim(
  order: (typeof orders)[number],
  summary: { id: string; claimNo: string; type: Claim["type"]; status: Claim["status"]; submittedAt: string },
): Claim {
  const existing = claimRow(summary.id);
  if (existing) return existing;
  const row = claim(40 + claims.length, order, summary.type, summary.status, "customer", {
    id: summary.id,
    claimNo: summary.claimNo,
    submittedAt: summary.submittedAt,
  });
  claims.push(row);
  return row;
}

let filed = 0;

/** A claim filed from the storefront: submitted, liability by rule (D-083), on the desk's queue. */
export function fileCustomerClaim(
  order: (typeof orders)[number],
  input: {
    type: Claim["type"];
    shipmentId: string | null;
    affectedQuantity: number | null;
    description: string;
    requestedResolution: Claim["requestedResolution"];
    productPhotos: FileRef[];
    cartonPhotos: FileRef[];
    receivedAt: string;
    windowEndsAt: string;
  },
): Claim {
  filed += 1;
  const shipment = order.shipments.find((candidate) => candidate.id === input.shipmentId) ?? order.shipments[0];
  const row = claim(100 + filed, order, input.type, "submitted", "customer", {
    id: mockId("clm", 700 + filed),
    claimNo: `CL-2569-W${String(filed).padStart(4, "0")}`,
    requestedResolution: input.requestedResolution,
    claimedAmount: null,
    submittedAt: bangkokIso(),
    slaDueAt: bangkokIso(DAY),
    shipment: shipment ? { id: shipment.id, shipmentNo: shipment.shipmentNo } : null,
    description: input.description,
    receivedAt: input.receivedAt,
    windowEndsAt: input.windowEndsAt,
    claimedQuantity: input.affectedQuantity,
    evidence: { productPhotos: input.productPhotos, cartonPhotos: input.cartonPhotos },
    approvedProof: null,
    messages: [{ at: bangkokIso(), author: order.customer.displayName, audience: "customer", body: input.description }],
    updatedAt: bangkokIso(),
  });
  claims.push(row);
  order.claims.push({
    id: row.id,
    claimNo: row.claimNo,
    type: row.type,
    status: row.status,
    submittedAt: row.submittedAt,
  });
  return row;
}

/** The customer answers in the thread; a claim waiting for information goes back to review. */
export function customerClaimReply(item: Claim, author: string, body: string): Claim {
  item.messages.push({ at: bangkokIso(), author, audience: "customer", body });
  if (item.status === "need_info") {
    item.status = "under_review";
    item.slaDueAt = bangkokIso(DAY);
  }
  item.updatedAt = bangkokIso();
  return item;
}

/* ------------------------------------------------------------------ the published shapes */

const pageOf = (url: URL) => ({
  page: Number(url.searchParams.get("page") ?? 1),
  perPage: Number(url.searchParams.get("perPage") ?? 25),
});

/** What the team last asked the customer, and the customer's answer after it (the thread is the fixture's). */
export function claimInfoOf(item: Claim) {
  const customer = item.customer.displayName;
  const asked = item.messages.findLastIndex(
    (message) => message.audience === "customer" && message.author !== customer,
  );
  if (asked < 0) return { infoRequest: null, infoResponse: null };
  const answer = item.messages.slice(asked + 1).find((message) => message.author === customer);
  return { infoRequest: item.messages[asked]!.body, infoResponse: answer?.body ?? null };
}

/** What a claim recovered from the factory (D-083): each factory-deduction resolution, offset on its payables. */
export function claimDeductionsOf(item: Claim): Schemas["ClaimDeductionDto"][] {
  return item.resolutions
    .map((resolution, index) => ({ resolution, index }))
    .filter(({ resolution }) => resolution.action === "factory_deduction" && resolution.amount)
    .map(({ resolution, index }) => ({
      id: mockId("vdd", Number.parseInt(item.id.slice(-6), 16) * 8 + index),
      amount: resolution.amount!,
      offsetAgainst: "payable" as const,
      status: "applied" as const,
      recordedAt: resolution.executedAt,
    }));
}

/** The sum of the applied and pending deductions, in satang arithmetic (the mock's, never the zone's). */
export function claimDeductionAmountOf(item: Claim): string {
  const total = claimDeductionsOf(item)
    .filter((deduction) => deduction.status !== "cancelled")
    .reduce((sum, deduction) => sum + Math.round(Number(deduction.amount) * 100), 0);
  return baht(total);
}

/** The fields of a claim its action guards read (packio-api `claims.service.ts`). */
interface ClaimFacts {
  status: string;
  liability: string;
  factoryId: string | null;
}

const REVIEWABLE = ["submitted", "need_info", "factory_review"];
const OVERRIDABLE = ["submitted", "under_review", "need_info", "factory_review"];

/** packio-api `src/modules/claims/claim-actions.ts` (v0.6.0), the staff rules. */
const ADMIN_CLAIM_ACTIONS: ActionRule<ClaimFacts>[] = [
  { key: "claim.review", permissions: ["claims.manage"], when: (c) => REVIEWABLE.includes(c.status) },
  { key: "claim.request_info", permissions: ["claims.manage"], when: (c) => c.status === "under_review" },
  {
    key: "claim.send_to_factory",
    permissions: ["claims.manage"],
    when: (c) => c.status === "under_review" && (c.factoryId !== null || "claims.no_factory"),
  },
  {
    key: "claim.override_liability",
    permissions: ["claims.override_liability"],
    when: (c) => OVERRIDABLE.includes(c.status),
  },
  {
    key: "claim.approve",
    permissions: ["claims.manage"],
    irreversible: true,
    when: (c) => c.status === "under_review" && (c.liability !== "undetermined" || "claims.liability_undetermined"),
  },
  { key: "claim.reject", permissions: ["claims.manage"], irreversible: true, when: (c) => c.status === "under_review" },
  { key: "claim.resolve", permissions: ["claims.resolve"], irreversible: true, when: (c) => c.status === "approved" },
  {
    key: "claim.close",
    permissions: ["claims.manage"],
    irreversible: true,
    when: (c) => c.status === "rejected" || c.status === "resolved",
  },
];

export const claimFactsOf = (item: Claim): ClaimFacts => ({
  status: item.status,
  liability: item.liability,
  factoryId: item.factory?.id ?? null,
});

/** A claim as `admin.claims.*` answers it, with what this staff member may do on it now. */
export function toAdminClaimDto(item: Claim, who: StaffPersona | null): Schemas["AdminClaimDto"] {
  const job = orders.find((order) => order.id === item.order.id)?.jobs[0];
  return {
    id: item.id,
    claimNo: item.claimNo,
    type: item.type,
    origin: item.origin,
    status: item.status,
    orderId: item.order.id,
    orderCode: item.order.orderCode,
    customer: item.customer,
    jobId: job?.id ?? null,
    jobNo: job?.jobNo ?? null,
    shipmentId: item.shipment?.id ?? null,
    shipmentNo: item.shipment?.shipmentNo ?? null,
    factoryId: item.factory?.id ?? null,
    factoryCode: item.factory?.code ?? null,
    description: item.description,
    requestedResolution: item.requestedResolution,
    claimedAmount: item.claimedAmount,
    claimedQuantity: item.claimedQuantity,
    liability: item.liability,
    liabilityByRule: item.liabilityByRule,
    liabilityRule: RULE_KEYS[item.type],
    liabilityOverriddenBy: item.liabilityOverride?.by ?? null,
    overrideReason: item.liabilityOverride?.reason ?? null,
    approvedProof: item.approvedProof ? { ...item.approvedProof, approvedFileId: null, channel: null } : null,
    photos: {
      product: item.evidence.productPhotos.map((photo) => photo.id),
      carton: item.evidence.cartonPhotos.map((photo) => photo.id),
    },
    ...claimInfoOf(item),
    factoryResponse: item.factoryResponse?.response ?? null,
    factoryResponseNote: item.factoryResponse?.note ?? null,
    factoryRespondedAt: item.factoryResponse?.at ?? null,
    factoryEvidenceFileIds: item.factoryEvidenceFileIds ?? [],
    decidedAt: item.decision?.at ?? null,
    decidedBy: item.decision?.by ?? null,
    decisionNote: item.decision?.reason ?? null,
    resolutions: item.resolutions.map((resolution) => ({
      action: resolution.action,
      amount: resolution.amount,
      executedAt: resolution.executedAt,
      jobNo: resolution.action === "reproduction_job" ? resolution.reference : null,
      quantity: resolution.action === "reproduction_job" ? item.claimedQuantity : null,
      refundId: null,
    })),
    deductions: claimDeductionsOf(item),
    deductionAmount: claimDeductionAmountOf(item),
    submittedAt: item.submittedAt,
    receivedAt: item.receivedAt,
    windowEndsAt: item.windowEndsAt,
    nextActions: nextActions(claimFactsOf(item), ADMIN_CLAIM_ACTIONS, (permission) =>
      Boolean(who && can(who, permission)),
    ),
  };
}

/* --------------------------------------------------------------------------------- handlers */

function access(request: Request, permission: string) {
  const who = staffPersonaOf(request);
  return who && can(who, permission) ? who : null;
}

/**
 * The published operations' Idempotency-Key (api-conventions §3): required, and a replay of the
 * same key answers what the first call did.
 */
const replays = new Map<string, unknown>();
async function idempotent(request: Request, run: () => Promise<Response> | Response): Promise<Response> {
  const key = request.headers.get("idempotency-key");
  if (!key) return problem(400, "idempotency.key_required", "ต้องระบุ Idempotency-Key");
  const scoped = `${new URL(request.url).pathname} ${key}`;
  if (replays.has(scoped))
    return HttpResponse.json(replays.get(scoped) as never, { headers: { "Idempotent-Replayed": "true" } });
  const response = await run();
  if (response.ok) replays.set(scoped, await response.clone().json());
  return response;
}

const claimOf = (id: unknown) => claims.find((candidate) => candidate.id === id);
const noClaim = () => problem(404, "http.not_found", "ไม่พบเคลมนี้");

const CLAIM_OPEN: readonly Claim["status"][] = ["submitted", "under_review", "need_info", "factory_review"];
const MONEY_ACTIONS = new Set(["refund", "credit_note", "store_credit", "factory_deduction", "carrier_recovery"]);
const RESOLUTIONS_BY_LIABILITY = (liability: Claim["liability"]): Claim["resolutions"][number]["action"][] =>
  liability === "factory"
    ? ["reproduction_job", "refund", "credit_note", "factory_deduction"]
    : liability === "carrier"
      ? ["refund", "credit_note", "carrier_recovery"]
      : ["refund", "credit_note", "store_credit"];

/** One claim step: the status it may start from, the one it lands on, and what the thread records. */
function step(
  path: string,
  from: readonly Claim["status"][],
  apply: (
    item: Claim,
    who: StaffPersona,
    body: { note?: string; decision?: Schemas["ClaimDecision"] },
  ) => Response | void,
) {
  return http.post(`*/v1/admin/claims/:claimId/actions/${path}`, ({ params, request }) =>
    idempotent(request, async () => {
      const who = access(request, "claims.manage");
      if (!who) return forbidden();
      const item = claimOf(params.claimId);
      if (!item) return noClaim();
      if (!from.includes(item.status))
        return problem(409, "claims.invalid_status", "ทำรายการนี้กับเคลมในสถานะนี้ไม่ได้");
      const body = ((await request.json().catch(() => ({}))) ?? {}) as {
        note?: string;
        decision?: Schemas["ClaimDecision"];
      };
      const refused = apply(item, who, body);
      if (refused) return refused;
      item.slaDueAt = ["under_review", "need_info", "factory_review"].includes(item.status) ? bangkokIso(DAY) : null;
      item.updatedAt = bangkokIso();
      return HttpResponse.json(toAdminClaimDto(item, who));
    }),
  );
}

const needNote = (note: string | undefined) =>
  !note || note.trim().length < 3
    ? problem(422, "validation.failed", "กรุณาระบุอย่างน้อย 3 ตัวอักษร", [
        { path: "note", code: "too_small", message: "อย่างน้อย 3 ตัวอักษร" },
      ])
    : null;

export const logisticsHandlers = [
  // admin.files.download for the claims' photos; any other file falls through to the next handler.
  http.get("*/v1/admin/files/:fileId/download", ({ params, request }) => {
    const fileId = String(params.fileId);
    const photoFile = claims
      .flatMap((item) => [...item.evidence.productPhotos, ...item.evidence.cartonPhotos])
      .find((file) => file.id === fileId);
    if (!photoFile) return undefined;
    if (!staffPersonaOf(request)) return problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
    const url = photoFile.url ?? `data:text/plain;charset=utf-8,${encodeURIComponent(photoFile.originalName)}`;
    return HttpResponse.json({ url, expiresAt: bangkokIso(5) } satisfies Schemas["DownloadUrlDto"]);
  }),

  /* ------------------------------------------------------------------- admin.claims (published) */
  http.get("*/v1/admin/claims", ({ request }) => {
    const who = access(request, "claims.read");
    if (!who) return forbidden();
    const url = new URL(request.url);
    const filter = (key: string) => url.searchParams.get(key);
    const q = filter("q") ?? undefined;
    const rows = claims
      .filter((item) => !filter("status") || item.status === filter("status"))
      .filter((item) => !filter("orderId") || item.order.id === filter("orderId"))
      .filter((item) => !filter("type") || item.type === filter("type"))
      .filter((item) => !filter("origin") || item.origin === filter("origin"))
      .filter((item) => !filter("customerId") || item.customer.id === filter("customerId"))
      .filter((item) => !filter("factoryId") || item.factory?.id === filter("factoryId"))
      .filter((item) => matchesQuery(q, item.claimNo, item.order.orderCode, item.customer.displayName))
      .map((item) => toAdminClaimDto(item, who));
    return HttpResponse.json(paginate(rows, pageOf(url)));
  }),
  http.get("*/v1/admin/claims/:claimId", ({ params, request }) => {
    const who = access(request, "claims.read");
    if (!who) return forbidden();
    const item = claimOf(params.claimId);
    return item
      ? HttpResponse.json(toAdminClaimDto(item, who), { headers: { ETag: etagOf(item as never) } })
      : noClaim();
  }),
  // The endpoints' own state checks, as the rules above offer them (packio-api `claims.service.ts`).
  step("review", REVIEWABLE as Claim["status"][], (item, who) => {
    item.status = "under_review";
    item.messages.push({ at: bangkokIso(), author: who.displayName, audience: "internal", body: "เริ่มตรวจสอบ" });
  }),
  step("request-info", ["under_review"], (item, who, body) => {
    const refused = needNote(body.note);
    if (refused) return refused;
    item.status = "need_info";
    item.messages.push({ at: bangkokIso(), author: who.displayName, audience: "customer", body: body.note!.trim() });
  }),
  step("send-to-factory", ["under_review"], (item, who) => {
    if (!item.factory) return problem(422, "claims.action_not_allowed", "เคลมนี้ไม่มีโรงงานให้ส่งตอบ");
    item.status = "factory_review";
    item.messages.push({ at: bangkokIso(), author: who.displayName, audience: "factory", body: "ส่งให้โรงงานตอบ" });
  }),
  step("decide", ["under_review"], (item, who, body) => {
    const refused = needNote(body.note);
    if (refused) return refused;
    if (body.decision !== "approved" && body.decision !== "rejected")
      return problem(422, "validation.failed", "ต้องเลือกอนุมัติหรือไม่อนุมัติ", [
        { path: "decision", code: "invalid_enum_value", message: "approved | rejected" },
      ]);
    if (body.decision === "approved" && item.liability === "undetermined")
      return problem(409, "claims.liability_undetermined", "ต้องระบุผู้รับผิดชอบก่อนอนุมัติ (D-083)");
    item.status = body.decision;
    item.decision = { by: ref(who), at: bangkokIso(), reason: body.note!.trim() };
    item.messages.push({ at: bangkokIso(), author: who.displayName, audience: "customer", body: body.note!.trim() });
  }),
  step("close", ["rejected", "resolved"], (item) => {
    item.status = "closed";
  }),
  http.post("*/v1/admin/claims/:claimId/actions/override-liability", ({ params, request }) =>
    idempotent(request, async () => {
      const who = access(request, "claims.override_liability");
      if (!who) return forbidden();
      const item = claimOf(params.claimId);
      if (!item) return noClaim();
      // Before the decision only (D-083).
      if (!CLAIM_OPEN.includes(item.status))
        return problem(409, "claims.invalid_status", "เปลี่ยนผู้รับผิดชอบได้ก่อนตัดสินเคลมเท่านั้น");
      const body = (await request.json()) as Schemas["OverrideLiabilityDto"];
      if (!body.reason || body.reason.trim().length < 10)
        return problem(422, "validation.failed", "กรุณาระบุเหตุผลอย่างน้อย 10 ตัวอักษร", [
          { path: "reason", code: "too_small", message: "อย่างน้อย 10 ตัวอักษร" },
        ]);
      item.liability = body.liability;
      item.liabilityOverride =
        body.liability === item.liabilityByRule ? null : { by: ref(who), reason: body.reason.trim(), at: bangkokIso() };
      item.updatedAt = bangkokIso();
      return HttpResponse.json(toAdminClaimDto(item, who));
    }),
  ),
  http.post("*/v1/admin/claims/:claimId/actions/resolve", ({ params, request }) =>
    idempotent(request, async () => {
      const who = access(request, "claims.resolve");
      if (!who) return forbidden();
      const item = claimOf(params.claimId);
      if (!item) return noClaim();
      if (item.status !== "approved")
        return problem(409, "claims.invalid_status", "ดำเนินการแก้ไขได้เมื่ออนุมัติเคลมแล้วเท่านั้น");
      const body = (await request.json()) as Schemas["ResolveClaimDto"];
      if (!Array.isArray(body.actions) || body.actions.length < 1 || body.actions.length > 6)
        return problem(422, "validation.failed", "ต้องมี 1–6 รายการ", [
          { path: "actions", code: "too_small", message: "1–6" },
        ]);
      const allowed = RESOLUTIONS_BY_LIABILITY(item.liability);
      for (const [index, action] of body.actions.entries()) {
        if (!allowed.includes(action.action))
          return problem(422, "claims.action_not_allowed", "ใช้วิธีนี้กับเคลมนี้ไม่ได้");
        if (MONEY_ACTIONS.has(action.action) && !action.amount)
          return problem(422, "validation.failed", "กรุณาระบุจำนวนเงิน", [
            { path: `actions[${index}].amount`, code: "required", message: "จำเป็น" },
          ]);
      }
      for (const action of body.actions) {
        const reference = {
          reproduction_job: `J-2569-${900 + item.resolutions.length}`,
          refund: `RF-2569-${String(300 + item.resolutions.length).padStart(5, "0")}`,
          credit_note: `CN-2569-${String(120 + item.resolutions.length).padStart(5, "0")}`,
          store_credit: null,
          factory_deduction: `VD-2569-${String(60 + item.resolutions.length).padStart(5, "0")}`,
          carrier_recovery: null,
        }[action.action];
        item.resolutions.push({
          action: action.action,
          amount: action.amount ?? null,
          reference,
          executedAt: bangkokIso(),
          executedBy: ref(who),
        });
        if (action.note)
          item.messages.push({ at: bangkokIso(), author: who.displayName, audience: "internal", body: action.note });
      }
      item.status = "resolved";
      item.updatedAt = bangkokIso();
      return HttpResponse.json(toAdminClaimDto(item, who));
    }),
  ),
];
