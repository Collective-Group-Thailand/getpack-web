/**
 * The published partner surface (packio-api B2.2) — the factory's own profile, onboarding,
 * compliance, configuration, price lists, price proposals and shipping rate card — mocked over
 * **the same rows the back office reviews** (`mocks/admin/partners.ts`). An application the owner
 * submits here lands in the Partner team's pipeline; a proposal submitted here is in the admin
 * proposals queue; a line Packio counters there is answered here. Typed by `Schemas`.
 *
 * Every handler goes through `own()` (./support.ts): other factories are 404 (D-044), roles are
 * checked against rbac.md's factory matrix. Nothing here returns a suggestion, benchmark or
 * another factory's price (D-044) — the partner DTOs have no field for one.
 */

import { http, HttpResponse, type HttpHandler } from "msw";

import type { Schemas } from "@/lib/api/types";

import { COMPONENTS, counts, nextId, proposal, proposals, stores, touch, type Store } from "../admin/partners";
import { catalogueRows } from "../admin/catalogue";
import { PRODUCT_TYPES } from "../admin/catalog";
import { openApproval } from "../admin/platform";
import { etagOf } from "../admin/tables";
import type { StaffPersona } from "../personas";
import { bangkokIso, matchesQuery, mockId, paginate, problem, sortBy } from "../support";
import type { PartnerPersona } from "./personas";
import { locked, once, own } from "./support";

type Factory = Schemas["FactoryDto"];
type Proposal = Schemas["PriceProposalDto"];
type ProposalLine = Schemas["PriceProposalLineDto"];
type Version = Schemas["PriceListVersionDto"];
type Row = Schemas["PriceRowDto"];

const DAY = 24 * 60;
const now = () => bangkokIso();
const invalid = (path: string, message: string, detail = "ข้อมูลไม่ถูกต้อง") =>
  problem(422, "validation.failed", detail, [{ path, code: "invalid", message }]);

/** A factory user as the approvals mock names a requester (it only reads id and name). */
const requester = (who: PartnerPersona) =>
  ({ id: who.id, displayName: who.displayName, key: who.key }) as unknown as StaffPersona;

const withEtag = (factory: Factory) => HttpResponse.json(factory, { headers: { ETag: etagOf(factory as never) } });

function ifMatch(request: Request, factory: Factory): Response | null {
  const match = request.headers.get("if-match");
  if (!match) return problem(428, "http.precondition_required", "ต้องส่ง If-Match");
  if (match !== etagOf(factory as never))
    return problem(412, "concurrency.stale", "ข้อมูลโรงงานถูกแก้ไขไปแล้ว กรุณาโหลดใหม่");
  return null;
}

function markStep(store: Store, step: Schemas["OnboardingStep"], status: Schemas["OnboardingStepStatus"]) {
  const row = store.steps.find((item) => item.step === step);
  if (!row || ["approved", "waived"].includes(row.status)) return;
  row.status = status;
  if (status === "approved") row.completedAt = now();
  touch(store);
}

/* ------------------------------------------------------------------------------ price rows */

/** A stable 64-hex line key from the line's dimensions (the API hashes them the same way). */
function lineKeyOf(component: string, dims: Record<string, unknown>): string {
  let hash = 0x811c9dc5;
  const text = `${component}|${JSON.stringify(dims)}`;
  let out = "";
  for (let round = 0; out.length < 64; round += 1) {
    for (const char of `${text}#${round}`) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
    out += hash.toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
}

const catalogueIds = (table: "materials" | "printTypes" | "finishes", count: number) =>
  catalogueRows(table)
    .filter((row) => row.status === "active")
    .slice(0, count)
    .map((row) => String(row.id));

/**
 * The rows of one version and component: generated, but stable per version, so the same version
 * always reads the same. A tier-B list covers fewer lines — only its envelope (D-043).
 */
function rowsOf(store: Store, version: Version, component: Schemas["PriceComponent"]): Row[] {
  const list = store.priceLists.find(
    (item) => item.current?.id === version.id || item.upcoming.some((v) => v.id === version.id),
  );
  const tier = store.config.participations.find((item) => item.productTypeId === list?.productTypeId)?.current?.tier;
  const narrow = tier === "B";
  const factor = 1 + (Number.parseInt(store.factory.code.slice(1), 10) % 5) / 20 + (version.versionNo - 1) * 0.03;
  const decimal = (value: number, scale: number) => (value * factor).toFixed(scale);
  const rows: { dims: Record<string, unknown>; values: Record<string, unknown> }[] = [];
  const materials = catalogueIds("materials", narrow ? 1 : 3);
  const printTypes = catalogueIds("printTypes", 1);
  const finishes = catalogueIds("finishes", narrow ? 1 : 2);
  switch (component) {
    case "material_prices":
      materials.forEach((materialId, index) =>
        (narrow
          ? [[1000, null]]
          : [
              [1000, 4999],
              [5000, null],
            ]
        ).forEach(([qtyFrom, qtyTo]) =>
          rows.push({
            dims: { materialId, qtyFrom, qtyTo },
            values: { rate: decimal(11.8 - index * 0.6 - (qtyFrom === 5000 ? 0.6 : 0), 6) },
          }),
        ),
      );
      break;
    case "print_prices":
      printTypes.forEach((printTypeId) =>
        (narrow ? [4] : [1, 2, 4]).forEach((colours) =>
          rows.push({
            dims: { printTypeId, colours },
            values: { setup: decimal(400 + colours * 200, 2), perSheet: decimal(0.25 + colours * 0.15, 6) },
          }),
        ),
      );
      break;
    case "finish_prices":
      finishes.forEach((finishId, index) =>
        rows.push({ dims: { finishId }, values: { perSqm: decimal(6.5 + index, 6), minimum: decimal(450, 2) } }),
      );
      break;
    case "print_wastes":
      (narrow ? [1000] : [1000, 5000, 10000]).forEach((qtyFrom, index) =>
        rows.push({ dims: { qtyFrom }, values: { sheets: 80 + index * 40 } }),
      );
      break;
    case "factory_margins":
      printTypes.forEach((printTypeId) => rows.push({ dims: { printTypeId }, values: { pct: decimal(18, 4) } }));
      break;
    default:
      break;
  }
  return rows.map((row) => ({
    component,
    lineKey: lineKeyOf(component, row.dims),
    values: { ...row.dims, ...row.values },
  }));
}

function versionOf(store: Store, versionId: string): Version | undefined {
  return store.priceLists
    .flatMap((list) => [list.current, ...list.upcoming])
    .find((version): version is Version => !!version && version.id === versionId);
}

/** The columns that identify a line of this component. */
const dimensionsOf = (component: Schemas["PriceComponent"]) =>
  COMPONENTS.find((item) => item.component === component)?.dimensions.map((column) => column.key) ?? [];

/* ------------------------------------------------------------------------ price proposals */

const OPEN: Proposal["status"][] = ["draft", "submitted", "under_review", "countered"];

/** Packio's drafts are never shown to a factory (B2.2 "Packio drafts are not visible"). */
const visibleTo = (factoryId: string) => (item: Proposal) =>
  item.factoryId === factoryId && !(item.direction === "packio_to_factory" && item.status === "draft");

function settle(item: Proposal, store: Store) {
  item.lineCounts = counts(item.lines);
  const { pending, accepted, rejected, countered, total } = item.lineCounts;
  if (pending > 0 || countered > 0) return;
  item.status = accepted === total ? "approved" : rejected === total ? "rejected" : "partially_approved";
  if (item.status !== "rejected") apply(item, store);
}

/** An agreed proposal becomes the price list's next version, from its effective date (D-040). */
function apply(item: Proposal, store: Store) {
  const list = store.priceLists.find((candidate) => candidate.id === item.priceListId);
  if (!list) return;
  const versionNo = Math.max(0, ...[list.current, ...list.upcoming].filter(Boolean).map((v) => v!.versionNo)) + 1;
  const effectiveFrom = Date.parse(item.proposedEffectiveFrom) > Date.now() ? item.proposedEffectiveFrom : now();
  const version: Version = {
    id: nextId("plv"),
    versionNo,
    status: "approved",
    origin: item.direction === "packio_to_factory" ? "platform_rate_card" : "factory_proposal",
    effectiveFrom,
    reason: item.comment ?? "",
    basedOnVersionNo: list.current?.versionNo ?? null,
    proposalId: item.id,
    contentSha256: lineKeyOf(item.id, { versionNo }),
    lineCount: (list.current?.lineCount ?? 0) + item.lines.filter((l) => l.action === "add").length,
    factoryAcceptedAt: item.direction === "packio_to_factory" ? now() : null,
    factorySignedOffAt: null,
    createdAt: now(),
  };
  if (Date.parse(effectiveFrom) <= Date.now()) list.current = version;
  else list.upcoming.push(version);
  item.resultingVersion = { id: version.id, versionNo, status: "approved" };
}

/* -------------------------------------------------------------------- shipping rate cards */

type RateVersion = Schemas["FactoryRateVersionDto"];

const shippingCards = new Map<string, RateVersion[]>();

/**
 * Factories still onboarding when the mock started get a card awaiting their answer; taken at
 * seed time, so a back-office test moving a factory on does not change what the partner sees.
 */
const ONBOARDING_AT_SEED = new Set(
  [...stores.values()]
    .filter((store) => ["applied", "under_review"].includes(store.factory.status))
    .map((store) => store.factory.id),
);

function rates(
  store: Store,
  acceptance: Schemas["RateLineAcceptance"],
  versionNo: number,
): Schemas["FactoryRateDto"][] {
  return store.zones
    .filter((zone) => zone.serves)
    .flatMap((zone, index) =>
      [
        [0, 5000],
        [5000, null],
      ].map(([weightMinG, weightMaxG], band) => ({
        id: mockId(
          "frt",
          Number.parseInt(store.factory.code.slice(1), 10) * 1000 + versionNo * 100 + index * 10 + band,
        ),
        zoneId: zone.zoneId,
        zoneCode: zone.zoneCode,
        postcode: null,
        weightMinG: weightMinG!,
        weightMaxG,
        volumeMinCm3: null,
        volumeMaxCm3: null,
        payoutAmount: (40 + index * 15 + band * 30).toFixed(2),
        perExtraKg: band === 1 ? (4 + index).toFixed(2) : null,
        acceptance,
        counterAmount: null,
        counterNote: null,
        counterPerExtraKg: null,
      })),
    );
}

function cardOf(store: Store): RateVersion[] {
  let versions = shippingCards.get(store.factory.id);
  if (!versions) {
    const onboarding = ONBOARDING_AT_SEED.has(store.factory.id);
    const accepted: RateVersion = {
      id: mockId("frv", Number.parseInt(store.factory.code.slice(1), 10) * 10 + 1),
      versionNo: 1,
      status: onboarding ? "pending_acceptance" : "approved",
      effectiveFrom: onboarding ? bangkokIso(DAY * 7) : bangkokIso(-DAY * 90),
      reason: onboarding ? "อัตราค่าส่งตั้งต้นตามพื้นที่ที่โรงงานส่งได้" : "อัตราเริ่มต้น",
      sentAt: bangkokIso(-DAY * (onboarding ? 1 : 95)),
      decidedAt: onboarding ? null : bangkokIso(-DAY * 92),
      factoryAcceptedAt: onboarding ? null : bangkokIso(-DAY * 92),
      rates: [],
      rateCount: 0,
      openLines: 0,
    };
    accepted.rates = rates(store, onboarding ? "pending" : "accepted", 1);
    versions = [accepted];
    versions.forEach(recount);
    shippingCards.set(store.factory.id, versions);
  }
  return versions;
}

function recount(version: RateVersion) {
  version.rateCount = version.rates.length;
  version.openLines = version.rates.filter((rate) => rate.acceptance !== "accepted").length;
}

const summaryOf = ({ rates: _rates, ...summary }: RateVersion): Schemas["FactoryRateVersionSummaryDto"] => summary;

/* -------------------------------------------------------------------------------- handlers */

export const factoryHandlers: HttpHandler[] = [
  http.get("*/v1/partner/factories", ({ request }) => {
    const ok = own(request, undefined);
    // `own` with no id is a 404 by design; the list is the factories of the token's scope.
    const principalProblem = ok instanceof Response && ok.status !== 404 ? ok : null;
    if (principalProblem) return principalProblem;
    const url = new URL(request.url);
    const rows = [...stores.values()]
      .map((store) => store.factory)
      .filter((factory) => !(own(request, factory.id) instanceof Response))
      .filter((factory) => matchesQuery(url.searchParams.get("q") ?? undefined, factory.code, factory.tradeName));
    return HttpResponse.json(paginate(rows, { page: 1, perPage: 25 }));
  }),
  http.get("*/v1/partner/factories/:factoryId", ({ request, params }) => {
    const ok = own(request, params.factoryId);
    return ok instanceof Response ? ok : withEtag(ok.store.factory);
  }),
  http.patch("*/v1/partner/factories/:factoryId", async ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_profile.manage");
    if (ok instanceof Response) return ok;
    const refused = ifMatch(request, ok.store.factory) ?? locked(ok.store);
    if (refused) return refused;
    const body = (await request.json()) as Schemas["UpdateOwnFactoryDto"];
    if (body.taxId !== undefined && !/^\d{13}$/.test(body.taxId))
      return invalid("taxId", "เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก");
    Object.assign(ok.store.factory, body);
    markStep(ok.store, "application", "in_progress");
    touch(ok.store);
    return withEtag(ok.store.factory);
  }),
  http.post("*/v1/partner/factories/:factoryId/actions/submit-application", async ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_profile.manage");
    if (ok instanceof Response) return ok;
    const { store } = ok;
    const refused = ifMatch(request, store.factory);
    if (refused) return refused;
    if (store.factory.status !== "applied")
      return problem(409, "partners.invalid_transition", "ส่งใบสมัครได้ครั้งเดียว ขณะที่ยังเป็นผู้สมัคร");
    const missing = [
      !store.addresses.some((address) => address.kind === "registered") && {
        path: "addresses",
        code: "required",
        message: "ต้องมีที่อยู่ตามทะเบียน",
      },
      !store.contacts.some((contact) => contact.isPrimary) && {
        path: "contacts",
        code: "required",
        message: "ต้องมีผู้ติดต่อหลัก",
      },
      store.kyc.length === 0 && { path: "kycDocuments", code: "required", message: "ต้องแนบเอกสารอย่างน้อยหนึ่งฉบับ" },
    ].filter(Boolean) as { path: string; code: string; message: string }[];
    if (missing.length) return problem(422, "partners.application_incomplete", "ใบสมัครยังไม่ครบ", missing);
    Object.assign(store.factory, { status: "under_review", statusChangedAt: now() });
    markStep(store, "application", "submitted");
    touch(store);
    return withEtag(store.factory);
  }),

  http.get("*/v1/partner/factories/:factoryId/onboarding-steps", ({ request, params }) => {
    const ok = own(request, params.factoryId);
    return ok instanceof Response ? ok : HttpResponse.json(ok.store.steps);
  }),
  http.post("*/v1/partner/factories/:factoryId/onboarding-steps/:step/actions/sign-off", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_onboarding.sign_off");
    if (ok instanceof Response) return ok;
    const step = ok.store.steps.find((item) => item.step === params.step);
    if (!step) return problem(404, "http.not_found", "ไม่พบขั้นตอนนี้");
    if (!step.enteredByStaff)
      return problem(409, "partners.nothing_to_sign_off", "ขั้นตอนนี้โรงงานกรอกเอง ไม่ต้องรับรอง");
    if (step.factorySignedOffAt) return HttpResponse.json(step);
    step.factorySignedOffAt = now();
    touch(ok.store);
    return HttpResponse.json(step);
  }),

  ...(["addresses", "contacts"] as const).flatMap((kind) => {
    const idParam = kind === "addresses" ? "addressId" : "contactId";
    const ns = kind === "addresses" ? "fad" : "fct";
    return [
      http.get(`*/v1/partner/factories/:factoryId/${kind}`, ({ request, params }) => {
        const ok = own(request, params.factoryId);
        return ok instanceof Response ? ok : HttpResponse.json(ok.store[kind]);
      }),
      http.post(`*/v1/partner/factories/:factoryId/${kind}`, async ({ request, params }) => {
        const ok = own(request, params.factoryId, "factory_profile.manage");
        if (ok instanceof Response) return ok;
        const refused = locked(ok.store);
        if (refused) return refused;
        const body = (await request.json()) as Record<string, unknown>;
        if (kind === "contacts" && !String(body.name ?? "").trim()) return invalid("name", "ต้องระบุชื่อ");
        if (kind === "addresses" && !String(body.line1 ?? "").trim()) return invalid("line1", "ต้องระบุที่อยู่");
        const created =
          kind === "addresses"
            ? { id: nextId(ns), line2: null, postcode: null, subdistrictId: null, lat: null, lng: null, ...body }
            : { id: nextId(ns), roleTitle: null, phone: null, email: null, isPrimary: false, ...body };
        if (kind === "contacts" && body.isPrimary) ok.store.contacts.forEach((contact) => (contact.isPrimary = false));
        (ok.store[kind] as unknown[]).push(created);
        markStep(ok.store, "application", "in_progress");
        return HttpResponse.json(created, { status: 201 });
      }),
      http.patch(`*/v1/partner/factories/:factoryId/${kind}/:${idParam}`, async ({ request, params }) => {
        const ok = own(request, params.factoryId, "factory_profile.manage");
        if (ok instanceof Response) return ok;
        const refused = locked(ok.store);
        if (refused) return refused;
        const row = (ok.store[kind] as { id: string; isPrimary?: boolean }[]).find(
          (item) => item.id === params[idParam],
        );
        if (!row) return problem(404, "http.not_found", "ไม่พบรายการนี้");
        const body = (await request.json()) as Record<string, unknown>;
        if (kind === "contacts" && body.isPrimary) ok.store.contacts.forEach((contact) => (contact.isPrimary = false));
        Object.assign(row, body);
        return HttpResponse.json(row);
      }),
    ];
  }),

  http.get("*/v1/partner/factories/:factoryId/kyc-documents", ({ request, params }) => {
    const ok = own(request, params.factoryId);
    return ok instanceof Response ? ok : HttpResponse.json(ok.store.kyc);
  }),
  http.post("*/v1/partner/factories/:factoryId/kyc-documents", async ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_profile.manage");
    if (ok instanceof Response) return ok;
    const refused = locked(ok.store);
    if (refused) return refused;
    const body = (await request.json()) as Schemas["CreateKycDocumentDto"];
    const created: Schemas["KycDocumentDto"] = {
      id: nextId("kyc"),
      docType: body.docType,
      fileId: body.fileId,
      issuedOn: body.issuedOn ?? null,
      expiresOn: body.expiresOn ?? null,
      status: "pending",
      verifiedAt: null,
      note: null,
    };
    ok.store.kyc.push(created);
    markStep(ok.store, "kyc", "submitted");
    return HttpResponse.json(created, { status: 201 });
  }),

  http.get("*/v1/partner/factories/:factoryId/bank-accounts", ({ request, params }) => {
    const ok = own(request, params.factoryId);
    if (ok instanceof Response) return ok;
    // The verification call stays with Packio Finance (B2.2): null on this surface.
    return HttpResponse.json([...ok.store.banks].reverse().map((bank) => ({ ...bank, verification: null })));
  }),
  http.post("*/v1/partner/factories/:factoryId/bank-accounts", async ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_bank_account.propose");
    if (ok instanceof Response) return ok;
    const body = (await request.json()) as Schemas["ProposeBankAccountDto"];
    const digits = body.accountNo.replace(/[\s-]/g, "");
    if (!/^\d{10,15}$/.test(digits)) return invalid("accountNo", "เลขบัญชีต้องเป็นตัวเลข 10–15 หลัก");
    if (!body.accountName.trim()) return invalid("accountName", "ต้องระบุชื่อบัญชี");
    if (ok.store.banks.some((bank) => bank.status === "pending_approval"))
      return problem(409, "partners.bank_change_pending", "มีบัญชีที่รออนุมัติอยู่แล้ว");
    const created: Schemas["BankAccountDto"] = {
      id: nextId("bnk"),
      bankCode: body.bankCode,
      accountName: body.accountName,
      accountNoLast4: digits.slice(-4),
      branchName: body.branchName ?? null,
      status: "pending_approval",
      duplicateOfOtherVendor: false,
      approvalRequestId: null,
      effectiveFrom: null,
      createdAt: now(),
      verification: null,
    };
    // D-033, D-169: dual approval (Finance → Finance Manager) after a logged call-back.
    created.approvalRequestId = openApproval({
      policy: "vendor_bank_account_change",
      subjectType: "vendor_bank_account",
      subjectId: created.id,
      requester: requester(ok.who),
      payload: {
        vendor: ok.store.factory.tradeName ?? ok.store.factory.legalName,
        bankLast4: created.accountNoLast4,
      },
    }).id;
    ok.store.banks.push(created);
    markStep(ok.store, "bank_account", "submitted");
    return HttpResponse.json({ ...created, verification: null }, { status: 201 });
  }),

  http.get("*/v1/partner/factories/:factoryId/capabilities", ({ request, params }) => {
    const ok = own(request, params.factoryId);
    return ok instanceof Response ? ok : HttpResponse.json(ok.store.capabilities);
  }),
  http.get("*/v1/partner/factories/:factoryId/delivery-zones", ({ request, params }) => {
    const ok = own(request, params.factoryId);
    return ok instanceof Response ? ok : HttpResponse.json(ok.store.zones);
  }),
  http.get("*/v1/partner/factories/:factoryId/configuration", ({ request, params }) => {
    const ok = own(request, params.factoryId);
    return ok instanceof Response ? ok : HttpResponse.json(ok.store.config);
  }),
  http.get("*/v1/partner/factories/:factoryId/capacity", ({ request, params }) => {
    const ok = own(request, params.factoryId);
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const productTypeId = url.searchParams.get("productTypeId");
    if (!productTypeId) return invalid("productTypeId", "ต้องระบุประเภทสินค้า");
    const capacity = ok.store.config.capacities.find((item) => item.productTypeId === productTypeId);
    if (!capacity) return HttpResponse.json([]);
    const weekly = Number(capacity.current?.weeklyCapacity ?? 0);
    const weeks = Math.min(26, Number(url.searchParams.get("weeks") ?? 8));
    const monday = new Date(Date.now() + 7 * 3_600_000);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    return HttpResponse.json(
      Array.from({ length: weeks }, (_, index): Schemas["CapacityWeekDto"] => {
        const weekStart = new Date(monday.getTime() + index * 7 * 86_400_000).toISOString().slice(0, 10);
        const override = ok.store.overrides.get(`${productTypeId}:${weekStart}`);
        const cap = override ?? weekly;
        const booked = Math.round(cap * Math.max(0, 0.85 - index * 0.12));
        return {
          weekStart,
          capacity: cap.toFixed(3),
          booked: booked.toFixed(3),
          free: (cap - booked).toFixed(3),
          source: override === undefined ? "version" : "override",
        };
      }),
    );
  }),

  http.get("*/v1/partner/factories/:factoryId/agreements", ({ request, params }) => {
    const ok = own(request, params.factoryId);
    return ok instanceof Response ? ok : HttpResponse.json(ok.store.agreements);
  }),
  http.post("*/v1/partner/factories/:factoryId/agreements/:key/acceptances", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_agreements.accept");
    if (ok instanceof Response) return ok;
    const agreement = ok.store.agreements.find((item) => item.key === params.key);
    if (!agreement) return problem(404, "http.not_found", "ไม่พบสัญญานี้");
    if (agreement.versionNo === null)
      return problem(409, "partners.agreement_not_published", "ยังไม่มีฉบับที่ใช้บังคับ");
    if (!agreement.accepted) Object.assign(agreement, { accepted: true, acceptedAt: now(), method: "e_acceptance" });
    if (ok.store.agreements.every((item) => item.accepted)) markStep(ok.store, "agreement", "approved");
    return HttpResponse.json(ok.store.agreements);
  }),

  /* ------------------------------------------------------------------------- prices */

  http.get("*/v1/partner/price-components", ({ request }) => {
    const ok = own(request, undefined);
    if (ok instanceof Response && ok.status !== 404) return ok;
    return HttpResponse.json(COMPONENTS);
  }),
  http.get("*/v1/partner/factories/:factoryId/price-lists", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_prices.read");
    if (ok instanceof Response) return ok;
    // Packio's drafts are never shown; a version pending the factory is.
    return HttpResponse.json(
      ok.store.priceLists.map((list) => ({
        ...list,
        upcoming: list.upcoming.filter((version) => version.status !== "draft"),
      })),
    );
  }),
  http.get("*/v1/partner/factories/:factoryId/price-list-versions/:versionId/lines", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_prices.read");
    if (ok instanceof Response) return ok;
    const version = versionOf(ok.store, String(params.versionId));
    if (!version || version.status === "draft") return problem(404, "http.not_found", "ไม่พบฉบับราคานี้");
    const url = new URL(request.url);
    const component = url.searchParams.get("component") as Schemas["PriceComponent"] | null;
    if (!component) return invalid("component", "ต้องระบุส่วนประกอบราคา");
    return HttpResponse.json(
      paginate(rowsOf(ok.store, version, component), {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 100),
      }),
    );
  }),
  http.post(
    "*/v1/partner/factories/:factoryId/price-list-versions/:versionId/actions/sign-off",
    ({ request, params }) =>
      once(request, `sign-off:${String(params.versionId)}`, () => {
        const ok = own(request, params.factoryId, "factory_onboarding.sign_off");
        if (ok instanceof Response) return ok;
        const list = ok.store.priceLists.find((item) => item.upcoming.some((v) => v.id === params.versionId));
        const version = list?.upcoming.find((v) => v.id === params.versionId);
        if (!list || !version) return problem(404, "http.not_found", "ไม่พบฉบับราคานี้");
        if (version.origin !== "assisted_entry" || version.factorySignedOffAt)
          return problem(409, "price.nothing_to_sign_off", "ฉบับนี้ไม่ต้องรับรองหรือรับรองแล้ว");
        // Applies from the later of its planned date and now (B2.2).
        Object.assign(version, {
          factorySignedOffAt: now(),
          status: "approved",
          effectiveFrom: Date.parse(version.effectiveFrom) > Date.now() ? version.effectiveFrom : now(),
        });
        if (Date.parse(version.effectiveFrom) <= Date.now()) {
          list.current = version;
          list.upcoming = list.upcoming.filter((v) => v !== version);
        }
        return HttpResponse.json(version);
      }),
  ),

  http.get("*/v1/partner/factories/:factoryId/price-proposals", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_prices.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const rows = proposals
      .filter(visibleTo(ok.store.factory.id))
      .filter((item) => !url.searchParams.get("status") || item.status === url.searchParams.get("status"))
      .filter((item) => !url.searchParams.get("direction") || item.direction === url.searchParams.get("direction"))
      .map(({ lines: _lines, ...summary }) => summary);
    return HttpResponse.json(
      paginate(sortBy(rows, "createdAt", "desc"), {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),
  http.post("*/v1/partner/factories/:factoryId/price-proposals", async ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_prices.propose");
    if (ok instanceof Response) return ok;
    const { store } = ok;
    const body = (await request.json()) as Schemas["CreatePriceProposalDto"];
    const type = PRODUCT_TYPES.find((candidate) => candidate.id === body.productTypeId);
    const list = store.priceLists.find((item) => item.productTypeId === body.productTypeId);
    if (!type || !list) return invalid("productTypeId", "โรงงานไม่มีรายการราคาของประเภทนี้");
    if (store.config.pricingArrangement.current?.ownershipMode !== "factory_price_list")
      return problem(409, "price.mode_rate_card", "โรงงานใช้อัตราของ Packio — ตอบรับหรือขอแก้อัตราแทนการเสนอราคา");
    const tier = store.config.participations.find((item) => item.productTypeId === type.id)?.current?.tier;
    if (tier !== "A" && tier !== "B")
      return problem(409, "price.tier_quote_only", "ประเภทนี้เป็นแบบเสนอราคาตามคำขอ (C) ยังไม่มีรายการราคา");
    if (proposals.some((item) => item.priceListId === list.id && OPEN.includes(item.status)))
      return problem(409, "price.proposal_open", "มีข้อเสนอราคาของรายการนี้ที่ยังเปิดอยู่");
    if (body.proposedEffectiveFrom && Date.parse(body.proposedEffectiveFrom) <= Date.now())
      return invalid("proposedEffectiveFrom", "วันที่มีผลต้องเป็นวันในอนาคต (ย้อนหลังไม่ได้)");
    const created = proposal(
      200 + proposals.length,
      store.factory.id,
      type.code,
      "factory_to_packio",
      "draft",
      [],
      body.comment ?? "",
    );
    created.comment = body.comment ?? null;
    created.createdAt = now();
    created.proposedEffectiveFrom = body.proposedEffectiveFrom ?? bangkokIso(DAY * 7);
    proposals.unshift(created);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.get("*/v1/partner/factories/:factoryId/price-proposals/:proposalId", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_prices.read");
    if (ok instanceof Response) return ok;
    const item = proposals.filter(visibleTo(ok.store.factory.id)).find((c) => c.id === params.proposalId);
    return item ? HttpResponse.json(item) : problem(404, "http.not_found", "ไม่พบข้อเสนอราคานี้");
  }),
  http.put("*/v1/partner/factories/:factoryId/price-proposals/:proposalId/lines", async ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_prices.propose");
    if (ok instanceof Response) return ok;
    const item = proposals.filter(visibleTo(ok.store.factory.id)).find((c) => c.id === params.proposalId);
    if (!item) return problem(404, "http.not_found", "ไม่พบข้อเสนอราคานี้");
    if (item.direction !== "factory_to_packio" || item.status !== "draft")
      return problem(409, "price.proposal_not_editable", "แก้ไขรายการได้เฉพาะฉบับร่าง");
    const { lines } = (await request.json()) as Schemas["ReplaceProposalLinesDto"];
    const list = ok.store.priceLists.find((candidate) => candidate.id === item.priceListId);
    const errors: { path: string; code: string; message: string }[] = [];
    const next: ProposalLine[] = lines.map((input, index) => {
      const dims = dimensionsOf(input.component);
      const values = (input.values ?? {}) as Record<string, unknown>;
      const key =
        input.lineKey ??
        lineKeyOf(input.component, Object.fromEntries(dims.map((column) => [column, values[column] ?? null])));
      const existing = list?.current ? rowsOf(ok.store, list.current, input.component) : [];
      const current = existing.find((row) => row.lineKey === key) ?? null;
      if (input.action !== "add" && !current)
        errors.push({ path: `lines[${index}].lineKey`, code: "ref", message: "ไม่พบบรรทัดนี้ในฉบับที่ใช้อยู่" });
      if (input.action === "add" && current)
        errors.push({ path: `lines[${index}]`, code: "unique", message: "มีบรรทัดนี้อยู่แล้ว ใช้การแก้ไขแทน" });
      if (input.action !== "remove" && dims.some((column) => values[column] === undefined))
        errors.push({ path: `lines[${index}].values`, code: "required", message: "ต้องระบุคอลัมน์ให้ครบ" });
      return {
        id: nextId("ppl"),
        lineKey: key,
        component: input.component,
        action: input.action,
        currentValues: current?.values ?? null,
        proposedValues: input.action === "remove" ? null : { ...(current?.values ?? {}), ...values },
        counterValues: null,
        decision: "pending",
        decidedAt: null,
        comment: null,
      };
    });
    if (errors.length) return problem(422, "validation.failed", "บางบรรทัดไม่ถูกต้อง", errors);
    item.lines = next;
    item.lineCounts = counts(next);
    return HttpResponse.json(item);
  }),
  http.post("*/v1/partner/factories/:factoryId/price-proposals/:proposalId/actions/submit", ({ request, params }) =>
    once(request, `submit:${String(params.proposalId)}`, () => {
      const ok = own(request, params.factoryId, "factory_prices.propose");
      if (ok instanceof Response) return ok;
      const item = proposals.filter(visibleTo(ok.store.factory.id)).find((c) => c.id === params.proposalId);
      if (!item) return problem(404, "http.not_found", "ไม่พบข้อเสนอราคานี้");
      if (item.direction !== "factory_to_packio" || item.status !== "draft" || item.lines.length === 0)
        return problem(409, "price.proposal_not_submittable", "ส่งได้เฉพาะฉบับร่างที่มีรายการ");
      const opened = openApproval({
        policy: "price_proposal",
        subjectType: "price_proposal",
        subjectId: item.id,
        requester: requester(ok.who),
        payload: { factory: ok.store.factory.code, productType: item.productTypeCode, lines: item.lines.length },
      });
      Object.assign(item, { status: "submitted", submittedAt: now(), approvalRequestId: opened.id });
      return HttpResponse.json(item);
    }),
  ),
  http.post(
    "*/v1/partner/factories/:factoryId/price-proposals/:proposalId/actions/withdraw",
    async ({ request, params }) => {
      const ok = own(request, params.factoryId, "factory_prices.propose");
      if (ok instanceof Response) return ok;
      const item = proposals.filter(visibleTo(ok.store.factory.id)).find((c) => c.id === params.proposalId);
      if (!item) return problem(404, "http.not_found", "ไม่พบข้อเสนอราคานี้");
      const { reason } = (await request.json()) as Schemas["ReasonBodyDto"];
      if (!reason || reason.trim().length < 3) return invalid("reason", "อย่างน้อย 3 ตัวอักษร", "ต้องระบุเหตุผล");
      if (item.direction !== "factory_to_packio" || !OPEN.includes(item.status))
        return problem(409, "price.proposal_not_withdrawable", "ถอนได้เฉพาะข้อเสนอของโรงงานที่ยังเปิดอยู่");
      Object.assign(item, { status: "withdrawn", comment: `${item.comment ?? ""}`.trim() || reason });
      return HttpResponse.json(item);
    },
  ),
  http.post("*/v1/partner/factories/:factoryId/price-proposals/:proposalId/actions/respond", ({ request, params }) =>
    once(request, `respond:${String(params.proposalId)}`, async () => {
      const ok = own(request, params.factoryId, "factory_rate_card.accept");
      if (ok instanceof Response) return ok;
      const item = proposals.filter(visibleTo(ok.store.factory.id)).find((c) => c.id === params.proposalId);
      if (!item) return problem(404, "http.not_found", "ไม่พบอัตรานี้");
      if (item.direction !== "packio_to_factory" || !["submitted", "under_review"].includes(item.status))
        return problem(409, "price.rate_card_not_open", "อัตรานี้ตอบไปแล้ว หรือยังไม่ได้ส่งถึงโรงงาน");
      const body = (await request.json()) as Schemas["RespondToRateCardDto"];
      if (!body.lines) {
        item.lines.forEach((target) => {
          if (target.decision === "pending") Object.assign(target, { decision: "accepted", decidedAt: now() });
        });
      } else {
        for (const [index, answer] of body.lines.entries()) {
          const target = item.lines.find((candidate) => candidate.id === answer.lineId);
          if (!target) return invalid(`lines[${index}].lineId`, "ไม่พบบรรทัดนี้");
          // CONTRACT-DEFECT: `response` is typed as its own DTO in the contract (enum name
          // collision); packio-api's source declares it `accept | counter`.
          const response = answer.response as unknown as "accept" | "counter";
          if (response === "counter" && !answer.counterValues)
            return invalid(`lines[${index}].counterValues`, "ต้องระบุอัตราที่ขอแทน");
          Object.assign(target, {
            decision: response === "accept" ? "accepted" : "countered",
            counterValues: response === "counter" ? answer.counterValues : null,
            comment: answer.comment ?? null,
            decidedAt: now(),
          });
        }
      }
      item.lineCounts = counts(item.lines);
      if (item.lineCounts.pending === 0 && item.lineCounts.countered === 0) {
        item.status = "accepted_by_factory";
        apply(item, ok.store);
        markStep(ok.store, "pricing_arrangement", "submitted");
      } else {
        item.status = "under_review";
      }
      return HttpResponse.json(item);
    }),
  ),
  http.post(
    "*/v1/partner/factories/:factoryId/price-proposals/:proposalId/actions/answer-counters",
    async ({ request, params }) => {
      const ok = own(request, params.factoryId, "factory_prices.propose");
      if (ok instanceof Response) return ok;
      const item = proposals.filter(visibleTo(ok.store.factory.id)).find((c) => c.id === params.proposalId);
      if (!item) return problem(404, "http.not_found", "ไม่พบข้อเสนอราคานี้");
      if (item.direction !== "factory_to_packio" || item.status !== "countered")
        return problem(409, "price.no_counters", "ไม่มีราคาที่ Packio เสนอกลับให้ตอบ");
      const body = (await request.json()) as Schemas["AnswerCountersDto"];
      for (const [index, answer] of body.lines.entries()) {
        const target = item.lines.find(
          (candidate) => candidate.id === answer.lineId && candidate.decision === "countered",
        );
        if (!target) return invalid(`lines[${index}].lineId`, "บรรทัดนี้ไม่มีราคาเสนอกลับ");
        if (answer.response === "accept")
          Object.assign(target, { decision: "accepted", proposedValues: target.counterValues, decidedAt: now() });
        else Object.assign(target, { decision: "rejected", decidedAt: now() });
      }
      settle(item, ok.store);
      return HttpResponse.json(item);
    },
  ),

  /* ------------------------------------------------------------------- shipping rates */

  http.get("*/v1/partner/factories/:factoryId/shipping-rate-card", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_prices.read");
    if (ok instanceof Response) return ok;
    const versions = cardOf(ok.store);
    const inForce = versions
      .filter((v) => v.status === "approved" && Date.parse(v.effectiveFrom) <= Date.now())
      .sort((a, b) => b.versionNo - a.versionNo)[0];
    const scheduled = versions.find((v) => v.status === "approved" && Date.parse(v.effectiveFrom) > Date.now());
    const open = versions.find((v) => v.status === "pending_acceptance");
    return HttpResponse.json({
      id: versions.length ? mockId("frc", Number.parseInt(ok.store.factory.code.slice(1), 10)) : null,
      factoryId: ok.store.factory.id,
      current: inForce ? summaryOf(inForce) : null,
      scheduled: scheduled ? summaryOf(scheduled) : null,
      open: open ? summaryOf(open) : null,
    } satisfies Schemas["FactoryRateCardDto"]);
  }),
  http.get("*/v1/partner/factories/:factoryId/shipping-rate-card/versions", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_prices.read");
    if (ok instanceof Response) return ok;
    return HttpResponse.json([...cardOf(ok.store)].sort((a, b) => b.versionNo - a.versionNo).map(summaryOf));
  }),
  http.get("*/v1/partner/factories/:factoryId/shipping-rate-card/versions/:versionId", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_prices.read");
    if (ok instanceof Response) return ok;
    const version = cardOf(ok.store).find((v) => v.id === params.versionId);
    return version ? HttpResponse.json(version) : problem(404, "http.not_found", "ไม่พบฉบับนี้");
  }),
  http.post(
    "*/v1/partner/factories/:factoryId/shipping-rate-card/versions/:versionId/actions/respond",
    ({ request, params }) =>
      once(request, `shipping:${String(params.versionId)}`, async () => {
        const ok = own(request, params.factoryId, "factory_rate_card.accept");
        if (ok instanceof Response) return ok;
        const version = cardOf(ok.store).find((v) => v.id === params.versionId);
        if (!version) return problem(404, "http.not_found", "ไม่พบฉบับนี้");
        if (version.status !== "pending_acceptance")
          return problem(409, "shipping.card_not_open", "ฉบับนี้ไม่ได้รอคำตอบจากโรงงาน");
        const body = (await request.json()) as Schemas["RespondToShippingCardDto"];
        if (!body.lines) {
          version.rates.forEach((rate) => {
            if (rate.acceptance === "pending") rate.acceptance = "accepted";
          });
        } else {
          for (const [index, answer] of body.lines.entries()) {
            const rate = version.rates.find((candidate) => candidate.id === answer.rateId);
            if (!rate) return invalid(`lines[${index}].rateId`, "ไม่พบอัตรานี้");
            if (answer.decision === "counter" && !answer.counterAmount)
              return invalid(`lines[${index}].counterAmount`, "ต้องระบุอัตราที่ขอแทน");
            Object.assign(rate, {
              acceptance: answer.decision === "accept" ? "accepted" : "countered",
              counterAmount: answer.decision === "counter" ? answer.counterAmount : null,
              counterPerExtraKg: answer.decision === "counter" ? (answer.counterPerExtraKg ?? null) : null,
              counterNote: answer.note ?? null,
            });
          }
        }
        recount(version);
        if (version.openLines === 0)
          Object.assign(version, { status: "approved", decidedAt: now(), factoryAcceptedAt: now() });
        return HttpResponse.json(version);
      }),
  ),
];
