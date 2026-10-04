/**
 * The rest of the factory's account (F5 5.3) on the published partner surface (contract v0.6.0):
 * claims that name the factory on the token-scoped `/v1/partner/claims` (`partner.claims.*`, D-082,
 * D-083), its monthly scorecard (`partner.production.scorecards`, D-155), its users and roles
 * (`partner.factoryUsers.*`, D-140, D-171), and each user's notification choices
 * (`partner.me.notificationPreferences`, D-231). Plus `partner.files.download` for the files these
 * screens show (claim photos, the factory's own uploads).
 *
 * Claims are the logistics desk's rows (`mocks/admin/logistics.ts`): what the factory answers lands
 * on the claims desk. A factory sees nothing of the customer beyond what D-142 allows.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import {
  claimDeductionAmountOf,
  claimDeductionsOf,
  claimFactsOf,
  claimInfoOf,
  claims,
  type Claim,
  claimTrustFactsOf,
} from "../admin/logistics";
import { fileDataUrl, files } from "../admin/platform";
import { orders } from "../admin/commerce";
import { stores } from "../admin/partners";
import { nextActions, type ActionRule } from "../next-actions";
import { bangkokIso, matchesQuery, mockId, paginate, problem } from "../support";
import { pageQuery, PDF, signed, statementStates } from "./billing";
import { factoryJobs } from "./jobs";
import { canPartner, PARTNER_PERSONAS, type PartnerPersona, type PartnerRole } from "./personas";
import { once, own, ownScope } from "./support";

const now = () => bangkokIso();
const invalid = (path: string, code: string, message: string) =>
  problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [{ path, code, message }]);

/* ------------------------------------------------------------------------------- claims */

/** packio-api `src/modules/claims/claim-actions.ts` (v0.6.0), the factory's rule. */
const PARTNER_CLAIM_ACTIONS: ActionRule<ReturnType<typeof claimFactsOf>>[] = [
  { key: "claim.respond", permissions: ["factory_claims.respond"], when: (c) => c.status === "factory_review" },
];

/** A claim as the factory reads it (`PartnerClaimDto`): the goods, never who the customer is (D-142). */
function toPartnerClaimDto(claim: Claim, who: PartnerPersona): Schemas["PartnerClaimDto"] {
  const job = orders.find((order) => order.id === claim.order.id)?.jobs[0];
  return {
    ...claimTrustFactsOf(claim.status),
    id: claim.id,
    claimNo: claim.claimNo,
    type: claim.type,
    origin: claim.origin,
    status: claim.status,
    orderId: claim.order.id,
    orderCode: claim.order.orderCode,
    jobId: job?.id ?? null,
    jobNo: job?.jobNo ?? null,
    shipmentNo: claim.shipment?.shipmentNo ?? null,
    description: claim.description,
    requestedResolution: claim.requestedResolution,
    claimedAmount: claim.claimedAmount,
    claimedQuantity: claim.claimedQuantity,
    liability: claim.liability,
    photos: {
      product: claim.evidence.productPhotos.map((photo) => photo.id),
      carton: claim.evidence.cartonPhotos.map((photo) => photo.id),
    },
    infoRequest: claim.status === "need_info" ? claimInfoOf(claim).infoRequest : null,
    factoryResponse: claim.factoryResponse?.response ?? null,
    factoryResponseNote: claim.factoryResponse?.note ?? null,
    factoryRespondedAt: claim.factoryResponse?.at ?? null,
    factoryEvidenceFileIds: claim.factoryEvidenceFileIds ?? [],
    decisionNote: claim.decision?.reason ?? null,
    resolutions: claim.resolutions.map((resolution) => ({
      action: resolution.action,
      amount: resolution.amount,
      executedAt: resolution.executedAt,
      jobNo: resolution.action === "reproduction_job" ? resolution.reference : null,
      quantity: resolution.action === "reproduction_job" ? claim.claimedQuantity : null,
      refundId: null,
    })),
    deductions: claimDeductionsOf(claim),
    deductionAmount: claimDeductionAmountOf(claim),
    submittedAt: claim.submittedAt,
    receivedAt: claim.receivedAt,
    windowEndsAt: claim.windowEndsAt,
    nextActions: nextActions(claimFactsOf(claim), PARTNER_CLAIM_ACTIONS, (permission) => canPartner(who, permission)),
  };
}

/* -------------------------------------------------------------------------- scorecards */

function scorecards(factoryId: string, months: number): Schemas["ScorecardDto"][] {
  const jobs = factoryJobs(factoryId).length;
  const seed = Number.parseInt(stores.get(factoryId)?.factory.code.slice(1) ?? "1", 10);
  const start = new Date(Date.now() + 7 * 3_600_000);
  return Array.from({ length: months }, (_, index) => {
    const at = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - index, 1));
    const wobble = ((index * 7 + seed * 3) % 9) - 4;
    const month = at.toISOString().slice(0, 10);
    return {
      month,
      jobsCount: Math.max(0, jobs - index),
      onTimeAcceptancePct: (94 + wobble / 2).toFixed(4),
      onTimeShippingPct: (88 + wobble).toFixed(4),
      qcFirstPassPct: (96 - Math.abs(wobble) / 2).toFixed(4),
      claimRatePct: (1.5 + Math.abs(wobble) / 4).toFixed(4),
      onTimeUpdatesPct: (90 + wobble).toFixed(4),
      sampleJobsCount: 0,
      sampleOnTimePct: null,
      sampleAvgLeadDays: null,
      // The month in progress is recomputed nightly; the closed ones on the first of the next month.
      computedAt: index === 0 ? bangkokIso(-60 * 6) : `${month.slice(0, 8)}01T02:00:00+07:00`,
    };
  });
}

/* ------------------------------------------------------------------------------- users */

const STAFF_ROLES: readonly string[] = [
  "factory_planner",
  "factory_operator",
  "factory_qc",
  "factory_shipping",
  "factory_accountant",
] satisfies Schemas["FactoryStaffRole"][];

interface UserRow {
  id: string;
  factoryId: string;
  displayName: string;
  email: string;
  roles: PartnerRole[];
  active: boolean;
  lastSignInAt: string | null;
}

/** People the owners added, and what changed for the seeded ones (roles, deactivation). */
const added: UserRow[] = [];
const changes = new Map<string, Partial<Pick<UserRow, "roles" | "active">>>();

function usersOf(factoryId: string): UserRow[] {
  const seeded = PARTNER_PERSONAS.filter((persona) => persona.factoryId === factoryId).map(
    (persona, index): UserRow => ({
      id: persona.id,
      factoryId,
      displayName: persona.displayName,
      email: persona.email,
      roles: persona.roles,
      active: true,
      lastSignInAt: bangkokIso(-60 * (index + 1) * 5),
    }),
  );
  return [...seeded, ...added.filter((user) => user.factoryId === factoryId)].map((user) => ({
    ...user,
    ...changes.get(user.id),
  }));
}

const toUserDto = (user: UserRow, who: PartnerPersona): Schemas["FactoryUserDto"] => ({
  id: user.id,
  displayName: user.displayName,
  email: user.email,
  roles: user.roles,
  status: user.active ? "active" : "deactivated",
  lastSignInAt: user.lastSignInAt,
  isSelf: user.id === who.id,
});

/** The guards `partner.factoryUsers.setRoles` / `deactivate` apply: never oneself, never the owner. */
function changeable(user: UserRow | undefined, who: PartnerPersona): Response | null {
  if (!user) return problem(404, "http.not_found", "ไม่พบผู้ใช้นี้");
  if (user.id === who.id) return problem(403, "iam.self_grant", "เปลี่ยนสิทธิ์ของตัวเองไม่ได้");
  if (user.active && user.roles.includes("factory_owner"))
    return problem(422, "factory_users.role_not_allowed", "เจ้าของโรงงานจัดการโดยทีมพาร์ตเนอร์ของ Packio");
  return null;
}

/* ----------------------------------------------------------------------- notifications */

const CATEGORIES: Schemas["PartnerNotificationCategory"][] = ["transactional", "security"];
const CHANNELS: Schemas["PartnerNotificationChannel"][] = ["web_push", "line", "email"];
/** E-mail of transactional events and every security message cannot be switched off (D-231). */
const lockedChoice = (channel: string, category: string) =>
  category === "security" || (category === "transactional" && channel === "email");
const choices = new Map<string, Map<string, boolean>>();

function preferencesOf(userId: string): Schemas["PartnerNotificationPreferencesDto"] {
  const mine = choices.get(userId);
  return {
    preferences: CATEGORIES.flatMap((category) =>
      CHANNELS.map((channel) => {
        const locked = lockedChoice(channel, category);
        return { category, channel, enabled: locked || (mine?.get(`${category}:${channel}`) ?? true), locked };
      }),
    ),
    lineLinked: false,
  };
}

/* ------------------------------------------------------------------------------- files */

/** Every file these screens name by id, and where its bytes are (a data URL, or the photo's own URL). */
function partnerFileUrl(fileId: string): string | null {
  const photo = claims
    .flatMap((claim) => [...claim.evidence.productPhotos, ...claim.evidence.cartonPhotos])
    .find((file) => file.id === fileId);
  if (photo) return photo.url ?? `data:text/plain;charset=utf-8,${encodeURIComponent(photo.originalName)}`;
  const invoiceFile = [...statementStates.values()]
    .flatMap((state) => state.invoices.map((invoice) => invoice.file))
    .find((file) => file?.id === fileId);
  if (invoiceFile) return invoiceFile.url ?? fileDataUrl(fileId) ?? PDF;
  const uploaded = files.get(fileId);
  if (uploaded)
    return (
      fileDataUrl(fileId) ??
      `data:text/plain;charset=utf-8,${encodeURIComponent(`${uploaded.originalName} (ข้อมูลจำลอง)`)}`
    );
  return null;
}

/* ----------------------------------------------------------------------------- handlers */

export const accountHandlers = [
  /* ---------------------------------------------------------------- claims (D-082, D-083) */
  http.get("*/v1/partner/claims", ({ request }) => {
    const ok = ownScope(request, "factory_claims.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const orderId = url.searchParams.get("orderId");
    const q = url.searchParams.get("q") ?? undefined;
    const rows = claims
      .filter((claim) => claim.factory?.id === ok.store.factory.id)
      .filter((claim) => !status || claim.status === status)
      .filter((claim) => !orderId || claim.order.id === orderId)
      .filter((claim) => matchesQuery(q, claim.claimNo, claim.order.orderCode))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .map((claim) => toPartnerClaimDto(claim, ok.who));
    return HttpResponse.json(paginate(rows, pageQuery(url)));
  }),
  http.get("*/v1/partner/claims/:claimId", ({ request, params }) => {
    const ok = ownScope(request, "factory_claims.read");
    if (ok instanceof Response) return ok;
    // Another factory's claim is not found (D-044).
    const claim = claims.find((item) => item.id === params.claimId && item.factory?.id === ok.store.factory.id);
    return claim ? HttpResponse.json(toPartnerClaimDto(claim, ok.who)) : problem(404, "http.not_found", "ไม่พบเคลมนี้");
  }),
  http.post("*/v1/partner/claims/:claimId/actions/respond", async ({ request, params }) => {
    const body = (await request
      .clone()
      .json()
      .catch(() => ({}))) as Partial<Schemas["FactoryClaimResponseDto"]>;
    return once(request, `claim-respond:${String(params.claimId)}`, () => {
      const ok = ownScope(request, "factory_claims.respond");
      if (ok instanceof Response) return ok;
      const claim = claims.find((item) => item.id === params.claimId && item.factory?.id === ok.store.factory.id);
      if (!claim) return problem(404, "http.not_found", "ไม่พบเคลมนี้");
      if (body.response !== "accepted" && body.response !== "disputed")
        return invalid("response", "invalid_enum_value", "accepted | disputed");
      if ((body.note?.length ?? 0) > 2000) return invalid("note", "too_big", "ไม่เกิน 2000 ตัวอักษร");
      const evidence = body.evidenceFileIds ?? [];
      if (evidence.some((id) => files.get(id)?.uploadStatus !== "uploaded"))
        return problem(422, "artwork.file_not_usable", "ไฟล์หลักฐานยังอัปโหลดไม่เสร็จ");
      if (claim.status !== "factory_review")
        return problem(409, "claims.invalid_status", "เคลมนี้ไม่ได้รอคำตอบจากโรงงาน");
      const note = body.note?.trim() || null;
      claim.factoryResponse = { response: body.response, note, at: now() };
      claim.factoryEvidenceFileIds = [...(claim.factoryEvidenceFileIds ?? []), ...evidence];
      // Back to the claims desk, with the factory's word on it (D-083).
      claim.status = "under_review";
      if (note) claim.messages.push({ at: now(), author: ok.who.displayName, audience: "factory", body: note });
      claim.updatedAt = now();
      return HttpResponse.json(toPartnerClaimDto(claim, ok.who));
    });
  }),

  /* ------------------------------------------------------------------- scorecard (D-155) */
  http.get("*/v1/partner/factories/:factoryId/scorecards", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_scorecard.read");
    if (ok instanceof Response) return ok;
    const asked = Number(new URL(request.url).searchParams.get("months") ?? 12);
    const months = Number.isInteger(asked) ? Math.min(24, Math.max(1, asked)) : 12;
    return HttpResponse.json(scorecards(ok.store.factory.id, months));
  }),

  /* ----------------------------------------------------------- users and roles (D-140) */
  http.get("*/v1/partner/factories/:factoryId/users", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_users.manage");
    if (ok instanceof Response) return ok;
    const status = new URL(request.url).searchParams.get("status") ?? "active";
    return HttpResponse.json(
      usersOf(ok.store.factory.id)
        .filter((user) => user.active === (status === "active"))
        .map((user) => toUserDto(user, ok.who)),
    );
  }),
  http.post("*/v1/partner/factories/:factoryId/users", async ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_users.manage");
    if (ok instanceof Response) return ok;
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas["CreateFactoryUserDto"]>;
    const email = body.email?.trim().toLowerCase() ?? "";
    const name = body.displayName?.trim() ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return invalid("email", "email", "อีเมลไม่ถูกต้อง");
    if (name.length < 1 || name.length > 120) return invalid("displayName", "too_small", "ระบุชื่อ");
    // Handed over out of band and changed at first sign-in; never kept or echoed by the mock.
    if ((body.initialPassword?.length ?? 0) < 12 || (body.initialPassword?.length ?? 0) > 200)
      return invalid("initialPassword", "too_small", "อย่างน้อย 12 ตัวอักษร");
    const roles = body.roles ?? [];
    if (!roles.length) return invalid("roles", "too_small", "อย่างน้อยหนึ่งบทบาท");
    if (roles.some((role) => !STAFF_ROLES.includes(role)))
      return problem(422, "factory_users.role_not_allowed", "ให้บทบาทนี้ไม่ได้ — เจ้าของโรงงานเพิ่มโดยทีมพาร์ตเนอร์");
    const taken =
      PARTNER_PERSONAS.some((persona) => persona.email.toLowerCase() === email) ||
      added.some((user) => user.email === email);
    if (taken) return problem(409, "iam.user_exists", "มีผู้ใช้อีเมลนี้แล้ว");
    const user: UserRow = {
      id: mockId("pui", added.length + 1),
      factoryId: ok.store.factory.id,
      displayName: name,
      email,
      roles: [...new Set(roles)],
      // Created active, with the password the owner hands over (no invitation flow).
      active: true,
      lastSignInAt: null,
    };
    added.push(user);
    return HttpResponse.json(toUserDto(user, ok.who), { status: 201 });
  }),
  http.put("*/v1/partner/factories/:factoryId/users/:userId/roles", async ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_users.manage");
    if (ok instanceof Response) return ok;
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas["SetFactoryUserRolesDto"]>;
    const roles = body.roles ?? [];
    if (!roles.length || roles.some((role) => !STAFF_ROLES.includes(role)))
      return problem(422, "factory_users.role_not_allowed", "ให้บทบาทนี้ไม่ได้");
    const user = usersOf(ok.store.factory.id).find((item) => item.id === params.userId);
    const refused = changeable(user, ok.who);
    if (refused) return refused;
    // Setting roles also reactivates a deactivated user (packio-api `FactoryUsersService.setRoles`).
    changes.set(user!.id, { roles: [...new Set(roles)], active: true });
    return HttpResponse.json(
      toUserDto(
        usersOf(ok.store.factory.id).find((item) => item.id === user!.id)!,
        ok.who,
      ),
    );
  }),
  http.post("*/v1/partner/factories/:factoryId/users/:userId/actions/deactivate", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_users.manage");
    if (ok instanceof Response) return ok;
    const user = usersOf(ok.store.factory.id).find((item) => item.id === params.userId);
    const refused = changeable(user, ok.who);
    if (refused) return refused;
    if (!user!.active) return problem(404, "http.not_found", "ผู้ใช้นี้ปิดการใช้งานแล้ว");
    changes.set(user!.id, { ...changes.get(user!.id), active: false });
    return new HttpResponse(null, { status: 204 });
  }),

  /* ------------------------------------------------------ notification choices (D-231) */
  http.get("*/v1/partner/me/notification-preferences", ({ request }) => {
    const ok = ownScope(request);
    if (ok instanceof Response) return ok;
    return HttpResponse.json(preferencesOf(ok.who.id));
  }),
  http.put("*/v1/partner/me/notification-preferences", async ({ request }) => {
    const ok = ownScope(request);
    if (ok instanceof Response) return ok;
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas["SetPartnerNotificationPreferencesDto"]>;
    const items = body.preferences ?? [];
    const locked = items.findIndex((item) => !item.enabled && lockedChoice(item.channel, item.category));
    if (locked >= 0)
      return invalid(
        `preferences.${locked}`,
        "locked",
        "อีเมลเรื่องงานและการจัดส่ง และข้อความด้านความปลอดภัยปิดไม่ได้",
      );
    const mine = choices.get(ok.who.id) ?? new Map<string, boolean>();
    for (const item of items) mine.set(`${item.category}:${item.channel}`, item.enabled);
    choices.set(ok.who.id, mine);
    return HttpResponse.json(preferencesOf(ok.who.id));
  }),

  /* --------------------------------------------------------------- partner.files.download */
  // The files this mock knows (claim photos, tax invoices, uploads); any other falls through.
  http.get("*/v1/partner/files/:fileId/download", ({ request, params }) => {
    const url = partnerFileUrl(String(params.fileId));
    if (!url) return undefined;
    const ok = ownScope(request);
    if (ok instanceof Response) return ok;
    return HttpResponse.json(signed(url));
  }),
];
