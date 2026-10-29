/**
 * C9 (D-457) the own-file check before ordering (`store.fileChecks.*`), offline. Nothing is read from the uploaded file:
 * the mock walks the five stages over a few seconds, "detects" the mock mailer box at size B, and reports an obviously
 * fake result — version 1 fails the bleed (must fix) and warns on one image; a corrected version passes. The spec,
 * versions, cart hand-off and ETag behave as the contract says.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { files } from "../admin/platform";
import { bangkokIso, mockId, problem, versionTag, withEtag } from "../support";
import { addToCart, attachCheckedFile, edited } from "./cart";
import { customerOf } from "./customers";
import { optionIdOf, quotesOf } from "./quotes";

type Check = Schemas["FileCheckDto"];
type Version = Schemas["FileCheckVersionDto"];

interface MockVersion {
  id: string;
  variantNo: number;
  versionNo: number;
  fileId: string;
  startedAt: number;
  removed: boolean;
  cartItemId: string | null;
}
interface MockCheck {
  id: string;
  persona: string;
  createdAt: string;
  productSlug: string | null;
  sizeCode: string | null;
  printMethod: Schemas["PrintSideMethod"] | null;
  printSpotColours: number | null;
  revision: number;
  versions: MockVersion[];
}

const checks = new Map<string, MockCheck>();
let seq = 0;
const STAGE_MS = 700;

/** The mock's only "die line": the mailer box (`mailer-box`) at its standard size B, 250 × 180 × 80. */
const DETECTED = {
  productSlug: "mailer-box",
  productNameTh: "กล่องไปรษณีย์",
  productNameEn: "Mailer box",
  sizeCode: "B",
  sizeName: "B",
  insideMm: [250, 180, 80],
  deltaMm: 0.3,
};
const SHEET = { widthMm: 900, heightMm: 440, source: "die" as const };
const PRODUCT_NAMES: Record<string, [string, string]> = {
  "mailer-box": ["กล่องไปรษณีย์", "Mailer box"],
  "shipping-box": ["กล่องลูกฟูกฝาชน", "Shipping box"],
  "telescope-box": ["กล่องฝาครอบ", "Telescope box"],
  "tuck-end-box": ["กล่องฝาเสียบ", "Tuck end box"],
};
const CHECKS: Schemas["UploadCheck"][] = [
  "size_mismatch",
  "missing_bleed",
  "safe_zone",
  "low_resolution",
  "fonts_not_embedded",
  "rgb_colour",
  "ink_count",
  "small_text",
  "thin_lines",
  "barcode",
  "die_layer",
  "small_text_black",
];
const NOT_EVALUATED = new Set<string>(["small_text", "small_text_black", "barcode"]);

function report(check: MockCheck, version: MockVersion): Schemas["FileCheckReportDto"] {
  const mismatch =
    (check.productSlug !== null && check.productSlug !== DETECTED.productSlug) ||
    (check.sizeCode !== null && check.sizeCode !== DETECTED.sizeCode);
  const first = version.versionNo === 1;
  const items = CHECKS.map((name): Schemas["FileCheckItemDto"] => {
    const base = { check: name, page: 1, measurements: {}, at: null };
    if (NOT_EVALUATED.has(name))
      return {
        ...base,
        level: "not_checked",
        messageTh: "ทีมเตรียมพิมพ์ตรวจให้ก่อนผลิต",
        messageEn: "Prepress checks it",
      };
    if (name === "size_mismatch" && mismatch)
      return {
        ...base,
        level: "must_fix",
        messageTh: "ขนาดงานไม่ตรงกับขนาดที่เลือก",
        messageEn: "The file does not match the chosen size",
      };
    if (name === "missing_bleed" && first)
      return {
        ...base,
        level: "must_fix",
        messageTh: "ระยะตัดตก (bleed) 0 มม. ไม่ถึง 3 มม. ทุกด้าน",
        messageEn: "Bleed 0 mm is less than 3 mm on some side",
        measurements: { leastBleedMm: 0, requiredMm: 3 },
      };
    if (name === "low_resolution" && first)
      return {
        ...base,
        level: "review",
        messageTh: "ภาพ 1 ภาพมีความละเอียดต่ำ (ต่ำสุด 150 ppi จากที่แนะนำ 300 ppi)",
        messageEn: "1 image below 300 ppi (lowest 150 ppi)",
        measurements: { lowestPpi: 150, minPpi: 300 },
        at: { x: 620, y: 300 },
      };
    if (name === "ink_count" && !check.printMethod)
      return {
        ...base,
        level: "not_checked",
        messageTh: "ยังไม่ได้เลือกระบบพิมพ์",
        messageEn: "No print method chosen",
      };
    return { ...base, level: "pass", messageTh: "ผ่าน", messageEn: "Passed" };
  });
  const counts = { mustFix: 0, review: 0, pass: 0, notChecked: 0 };
  for (const item of items)
    counts[item.level === "must_fix" ? "mustFix" : item.level === "not_checked" ? "notChecked" : item.level] += 1;
  return {
    items,
    counts,
    blocking: counts.mustFix > 0,
    page: { mediaBox: [0, 0, 2568, 1264], trimBox: [8.5, 8.5, 2559.5, 1255.5], dieBox: [8.5, 8.5, 2559.5, 1255.5] },
    expected: { widthMm: SHEET.widthMm, heightMm: SHEET.heightMm },
    inks: { process: true, spotColours: [], recommended: "cmyk" },
  };
}

function versionDto(check: MockCheck, v: MockVersion): Version {
  const stage = Math.min(5, Math.floor((Date.now() - v.startedAt) / STAGE_MS));
  const file = files.get(v.fileId);
  const done = stage >= 5;
  return {
    id: v.id,
    versionNo: v.versionNo,
    fileId: v.fileId,
    fileName: file?.originalName ?? "artwork.pdf",
    sizeBytes: file?.sizeBytes ?? 0,
    status: done ? "done" : stage === 0 ? "queued" : "running",
    stage,
    error: null,
    detection: stage >= 3 ? { sheet: SHEET, match: DETECTED } : null,
    report: done ? report(check, v) : null,
    cartItemId: v.cartItemId,
    createdAt: bangkokIso(),
    completedAt: done ? bangkokIso() : null,
  };
}

function toDto(check: MockCheck): Check {
  // A check with no product takes the detected one once the die lines are read (as the worker does).
  if (!check.productSlug && check.versions.some((v) => Date.now() - v.startedAt >= 3 * STAGE_MS)) {
    check.productSlug = DETECTED.productSlug;
    check.sizeCode = DETECTED.sizeCode;
  }
  const live = check.versions.filter((v) => !v.removed);
  const variantNos = [...new Set(live.map((v) => v.variantNo))].sort((a, b) => a - b);
  const variants = variantNos.map((variantNo) => {
    const mine = live.filter((v) => v.variantNo === variantNo).sort((a, b) => b.versionNo - a.versionNo);
    return { variantNo, current: versionDto(check, mine[0]!), history: mine.slice(1).map((v) => versionDto(check, v)) };
  });
  const done = variants.every((v) => v.current.status === "done");
  const names = check.productSlug ? PRODUCT_NAMES[check.productSlug] : undefined;
  return {
    id: check.id,
    spec: {
      productSlug: check.productSlug,
      productNameTh: names?.[0] ?? null,
      productNameEn: names?.[1] ?? null,
      sizeCode: check.sizeCode,
      printMethod: check.printMethod,
      printSpotColours: check.printSpotColours,
    },
    variants,
    done,
    blocking: !done || variants.some((v) => v.current.report?.blocking !== false),
    revision: check.revision,
    createdAt: check.createdAt,
    statusUrl: `/v1/store/file-checks/${check.id}`,
  };
}

const tag = (check: MockCheck) => versionTag(`file-check-${check.id}`, check.revision);
const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = () => problem(404, "http.not_found", "ไม่พบการตรวจไฟล์นี้");

function mine(request: Request, id: unknown) {
  const customer = customerOf(request);
  if (!customer) return { error: unauthenticated() };
  const check = checks.get(String(id));
  if (!check || check.persona !== customer.persona) return { error: notFound() };
  return { check, customer };
}

function newVersion(variantNo: number, versionNo: number, fileId: string): MockVersion {
  seq += 1;
  return {
    id: mockId("fcv", seq),
    variantNo,
    versionNo,
    fileId,
    startedAt: Date.now(),
    removed: false,
    cartItemId: null,
  };
}

export const fileCheckHandlers = [
  http.get("*/v1/store/file-checks/rules", () =>
    HttpResponse.json({
      bleedMm: "3",
      safeZoneMm: "3",
      // C12 (D-460): the reference seed's corrugated print profile.
      corrugatedSafeZoneMm: "5",
      sizeToleranceMm: "1",
      maxBytes: 209_715_200,
      extensions: [".pdf", ".ai"],
      checks: CHECKS.map((check) => ({ check, evaluated: !NOT_EVALUATED.has(check) })),
    } satisfies Schemas["FileCheckRulesDto"]),
  ),

  http.get("*/v1/store/file-checks/reorderable", ({ request }) =>
    customerOf(request)
      ? HttpResponse.json({ data: [] } satisfies Schemas["ReorderableFileListDto"])
      : unauthenticated(),
  ),

  http.post("*/v1/store/file-checks", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const body = (await request.json()) as Schemas["CreateFileCheckDto"];
    if (!body.fileIds?.length) return problem(422, "validation.failed", "ต้องมีไฟล์อย่างน้อย 1 ไฟล์");
    seq += 1;
    const check: MockCheck = {
      id: mockId("fck", seq),
      persona: customer.persona,
      createdAt: bangkokIso(),
      productSlug: body.productSlug ?? null,
      sizeCode: body.sizeCode ?? null,
      printMethod: null,
      printSpotColours: null,
      revision: 1,
      versions: body.fileIds.map((fileId, index) => newVersion(index + 1, 1, fileId)),
    };
    checks.set(check.id, check);
    return withEtag(toDto(check), tag(check), 201);
  }),

  http.get("*/v1/store/file-checks/:checkId", ({ request, params }) => {
    const found = mine(request, params.checkId);
    if (found.error) return found.error;
    return withEtag(toDto(found.check), tag(found.check));
  }),

  http.get("*/v1/store/file-checks/:checkId/versions/:versionId/file", ({ request, params }) => {
    const found = mine(request, params.checkId);
    if (found.error) return found.error;
    const version = found.check.versions.find((v) => v.id === params.versionId);
    if (!version) return notFound();
    return HttpResponse.json({ url: `/bff/v1/store/files/${version.fileId}/download` });
  }),

  http.patch("*/v1/store/file-checks/:checkId", async ({ request, params }) => {
    const found = mine(request, params.checkId);
    if (found.error) return found.error;
    const { check } = found;
    if (check.versions.some((v) => v.cartItemId && !v.removed))
      return problem(409, "file_checks.in_cart", "ไฟล์นี้อยู่ในตะกร้าแล้ว");
    const body = (await request.json()) as Schemas["UpdateFileCheckSpecDto"];
    if (body.productSlug !== undefined) {
      if (body.productSlug !== check.productSlug) check.sizeCode = null;
      check.productSlug = body.productSlug;
    }
    if (body.sizeCode !== undefined) check.sizeCode = body.sizeCode;
    if (body.printMethod !== undefined) check.printMethod = body.printMethod;
    if (body.printSpotColours !== undefined) check.printSpotColours = body.printSpotColours;
    check.revision += 1;
    return withEtag(toDto(check), tag(check));
  }),

  http.post("*/v1/store/file-checks/:checkId/files", async ({ request, params }) => {
    const found = mine(request, params.checkId);
    if (found.error) return found.error;
    const { check } = found;
    const body = (await request.json()) as Schemas["AddFileCheckFileDto"];
    if (body.variantNo !== undefined) {
      const same = check.versions.filter((v) => v.variantNo === body.variantNo && !v.removed);
      if (!same.length) return notFound();
      check.versions.push(newVersion(body.variantNo, Math.max(...same.map((v) => v.versionNo)) + 1, body.fileId));
    } else {
      check.versions.push(newVersion(Math.max(0, ...check.versions.map((v) => v.variantNo)) + 1, 1, body.fileId));
    }
    check.revision += 1;
    return withEtag(toDto(check), tag(check), 201);
  }),

  http.delete("*/v1/store/file-checks/:checkId/variants/:variantNo", ({ request, params }) => {
    const found = mine(request, params.checkId);
    if (found.error) return found.error;
    const { check } = found;
    const versions = check.versions.filter((v) => v.variantNo === Number(params.variantNo) && !v.removed);
    if (!versions.length) return notFound();
    for (const v of versions) v.removed = true;
    check.revision += 1;
    return withEtag(toDto(check), tag(check));
  }),

  http.post("*/v1/store/file-checks/:checkId/actions/add-to-cart", async ({ request, params }) => {
    const found = mine(request, params.checkId);
    if (found.error) return found.error;
    const { check, customer } = found;
    const body = (await request.json()) as Schemas["FileCheckCartDto"];
    const dto = toDto(check);
    const variant = dto.variants.find((v) => v.variantNo === body.variantNo);
    if (!variant) return notFound();
    if (variant.current.status !== "done") return problem(409, "file_checks.not_ready", "ยังตรวจไฟล์ไม่เสร็จ");
    if (variant.current.report?.blocking) return problem(409, "file_checks.blocking", "ไฟล์ยังมีข้อที่ต้องแก้");
    const quote = quotesOf(customer.persona).find((q) => q.id === body.quoteId);
    if (!quote || optionIdOf(quote) !== body.quoteOptionId) return problem(404, "http.not_found", "ไม่พบใบเสนอราคานี้");
    const lineId = addToCart(customer, quote);
    attachCheckedFile(customer, lineId, {
      fileCheckId: check.id,
      variantNo: variant.variantNo,
      versionNo: variant.current.versionNo,
      originalFileId: variant.current.fileId,
      printFileId: variant.current.fileId,
      reportId: variant.current.id,
      fileName: variant.current.fileName,
    });
    const version = check.versions.find((v) => v.id === variant.current.id)!;
    version.cartItemId = lineId;
    check.revision += 1;
    edited(customer, 201);
    return HttpResponse.json({ check: toDto(check), cartItemId: lineId } satisfies Schemas["FileCheckCartResultDto"], {
      status: 201,
    });
  }),
];
