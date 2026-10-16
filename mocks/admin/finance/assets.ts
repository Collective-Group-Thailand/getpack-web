/**
 * Fixed assets (getpack-api B5.5, published; D-150): categories whose accounts and useful life
 * are snapshotted on each asset, the register (from a vendor bill already capitalised by P25, or
 * manual — FA01 against an account Finance names), straight-line depreciation by month (FA02,
 * one run per month into an open month; accumulated = round(depreciable × months ÷ life), so the
 * last month takes the rounding), disposal and write-off (FA03), and the roll-forward with its
 * reconciliation of the register to the GL (§7 step 8).
 *
 * The monthly preview (`admin.fixedAssets.previewRun`, U-B0.3) shares the run's lines, so what it
 * shows is what posts.
 */

import { HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { bangkokIso, mockId, problem } from "../../support";
import { baht } from "../commerce";
import { settingValue } from "../platform";
import { ACCOUNTS, fiscalYears, journals, post, previousMonth, satangOf } from "./books";
import { invoicesAll } from "./payables";
import { finance, invalid, isMoney, notFound } from "./support";

type Category = Schemas["AssetCategoryDto"];
type Asset = Schemas["FixedAssetDto"];
type Run = Schemas["DepreciationRunDto"];
type DepLine = Schemas["DepreciationLineDto"] & { assetId: string };

const round = (value: number) => Math.round(value);

/* -------------------------------------------------------------------------------- categories */

const category = (n: number, code: string, nameTh: string, nameEn: string, usefulLifeMonths: number): Category => ({
  id: mockId("acat", n),
  code,
  nameTh,
  nameEn,
  method: "straight_line",
  usefulLifeMonths,
  assetAccountCode: "1510",
  accumulatedAccountCode: "1519",
  expenseAccountCode: "6150",
  gainLossAccountCode: "6900",
  status: "active",
  rowVersion: 1,
});

export const categories: Category[] = [
  category(1, "computer", "คอมพิวเตอร์และอุปกรณ์", "Computers & peripherals", 36),
  category(2, "office_equipment", "อุปกรณ์สำนักงาน", "Office equipment", 60),
  category(3, "furniture", "เครื่องตกแต่งและติดตั้ง", "Furniture & fittings", 60),
];

/* ---------------------------------------------------------------------------------- register */

export const assets: Asset[] = [];
export const depreciationLines: DepLine[] = [];
export const depreciationRuns: Run[] = [];
let assetSeq = 0;

const monthIndex = (from: string, to: string) =>
  (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + (Number(to.slice(5, 7)) - Number(from.slice(5, 7)));

const addMonths = (month: string, by: number) => {
  const [year, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, m - 1 + by, 1)).toISOString().slice(0, 7);
};

/** Accumulated depreciation (satang) an asset should carry at the end of `month`. */
function expectedAccumulated(asset: Asset, month: string): number {
  const months = Math.min(
    Math.max(monthIndex(asset.depreciationStartOn.slice(0, 7), month) + 1, 0),
    asset.usefulLifeMonths,
  );
  const depreciable = satangOf(asset.cost) - satangOf(asset.residualValue);
  return months === asset.usefulLifeMonths ? depreciable : round((depreciable * months) / asset.usefulLifeMonths);
}

function register(input: {
  category: Category;
  name: string;
  acquiredOn: string;
  cost: number;
  residual: number;
  source: Asset["source"];
  creditAccountCode: string | null;
  vendorInvoiceId: string | null;
  costCentreCode?: string | null;
  location?: string | null;
  custodianUserId?: string | null;
}): Asset {
  assetSeq += 1;
  const start = settingValue<"acquisition_month" | "next_month">("fixed_assets.depreciation_start");
  const month = input.acquiredOn.slice(0, 7);
  const asset: Asset = {
    id: mockId("fa", assetSeq),
    assetNo: `FA-${Number(input.acquiredOn.slice(0, 4)) + 543}-${String(assetSeq).padStart(4, "0")}`,
    name: input.name,
    categoryId: input.category.id,
    categoryCode: input.category.code,
    assetAccountCode: input.category.assetAccountCode,
    acquiredOn: input.acquiredOn,
    depreciationStartOn: `${start === "next_month" ? addMonths(month, 1) : month}-01`,
    usefulLifeMonths: input.category.usefulLifeMonths,
    cost: baht(input.cost),
    residualValue: baht(input.residual),
    accumulatedDepreciation: "0.00",
    netBookValue: baht(input.cost),
    source: input.source,
    creditAccountCode: input.creditAccountCode,
    vendorInvoiceId: input.vendorInvoiceId,
    costCentreCode: input.costCentreCode ?? null,
    location: input.location ?? null,
    custodianUserId: input.custodianUserId ?? null,
    status: "active",
    disposedOn: null,
    disposalProceeds: null,
  };
  assets.push(asset);
  if (input.source === "manual")
    post({
      rule: "FA01",
      description: `ขึ้นทะเบียนสินทรัพย์ ${asset.assetNo} ${asset.name}`,
      documentDate: input.acquiredOn,
      source: { type: "fixed_asset", id: asset.id, number: asset.assetNo },
      lines: [
        {
          account: asset.assetAccountCode,
          debit: input.cost,
          dimensions: input.costCentreCode ? { costCentre: input.costCentreCode } : {},
        },
        { account: input.creditAccountCode!, credit: input.cost },
      ],
    });
  return asset;
}

/* ------------------------------------------------------------------------------ depreciation */

const periodOfMonth = (month: string) =>
  fiscalYears.flatMap((year) => year.periods).find((period) => period.startDate === `${month}-01`);

/** What the month's run would post, per asset (satang) — the run and the preview share it. */
function dueLines(month: string) {
  return assets
    .filter((asset) => asset.status === "active" && asset.depreciationStartOn.slice(0, 7) <= month)
    .map((asset) => {
      const accumulated = satangOf(asset.accumulatedDepreciation);
      const amount = expectedAccumulated(asset, month) - accumulated;
      return { asset, amount, accumulatedAfter: accumulated + amount };
    })
    .filter((line) => line.amount > 0);
}

export function runDepreciation(month: string, runOn: string): Run | Response {
  const period = periodOfMonth(month);
  if (!period) return notFound("งวดบัญชี");
  if (period.status !== "open") return problem(409, "ledger.period_closed", `งวด ${month} ไม่เปิดรับรายการแล้ว`);
  if (depreciationRuns.some((run) => run.period === month))
    return problem(409, "fixed_assets.run_exists", `ค่าเสื่อมราคางวด ${month} บันทึกไปแล้ว`);
  const lines = dueLines(month);
  const run: Run = {
    id: mockId("dpr", depreciationRuns.length + 1),
    period: month,
    runOn,
    assetCount: lines.length,
    totalAmount: baht(lines.reduce((sum, line) => sum + line.amount, 0)),
  };
  if (lines.length) {
    const byCategory = new Map<
      string,
      { expense: string; accumulated: string; amount: number; costCentre: string | null }
    >();
    for (const { asset, amount } of lines) {
      const cat = categories.find((item) => item.id === asset.categoryId)!;
      const key = `${cat.id}:${asset.costCentreCode ?? ""}`;
      const entry = byCategory.get(key) ?? {
        expense: cat.expenseAccountCode,
        accumulated: cat.accumulatedAccountCode,
        amount: 0,
        costCentre: asset.costCentreCode,
      };
      entry.amount += amount;
      byCategory.set(key, entry);
    }
    post({
      rule: "FA02",
      description: `ค่าเสื่อมราคา งวด ${month}`,
      documentDate: period.endDate,
      source: { type: "depreciation_run", id: run.id, number: `DEP-${month}` },
      lines: [...byCategory.values()].flatMap((entry) => [
        {
          account: entry.expense,
          debit: entry.amount,
          dimensions: entry.costCentre ? { costCentre: entry.costCentre } : {},
        },
        { account: entry.accumulated, credit: entry.amount },
      ]),
    });
  }
  for (const { asset, amount, accumulatedAfter } of lines) {
    depreciationLines.push({
      assetId: asset.id,
      runId: run.id,
      period: month,
      amount: baht(amount),
      accumulatedAfter: baht(accumulatedAfter),
    });
    const fully = accumulatedAfter === satangOf(asset.cost) - satangOf(asset.residualValue);
    Object.assign(asset, {
      accumulatedDepreciation: baht(accumulatedAfter),
      netBookValue: baht(satangOf(asset.cost) - accumulatedAfter),
      status: fully ? "fully_depreciated" : "active",
    });
  }
  depreciationRuns.unshift(run);
  return run;
}

/* -------------------------------------------------------------------------------- roll-forward */

export function rollForward(from: string, to: string): Schemas["RollForwardDto"] {
  const start = `${from}-01`;
  const end = periodOfMonth(to)?.endDate ?? `${to}-31`;
  const rows = new Map<string, Record<string, number | string>>();
  const registerByAccount = new Map<string, number>();
  const add = (code: string, value: number) => registerByAccount.set(code, (registerByAccount.get(code) ?? 0) + value);
  for (const asset of assets.filter((item) => item.acquiredOn <= end)) {
    const cat = categories.find((item) => item.id === asset.categoryId)!;
    const row =
      rows.get(cat.code) ??
      ({
        category: cat.code,
        name: cat.nameTh,
        openingCost: 0,
        additions: 0,
        disposalsCost: 0,
        openingAccumulated: 0,
        depreciation: 0,
        disposalsAccumulated: 0,
      } as Record<string, number | string>);
    const m = (key: string, value: number) => (row[key] = (row[key] as number) + value);
    const cost = satangOf(asset.cost);
    const own = depreciationLines.filter((line) => line.assetId === asset.id);
    const before = own
      .filter((line) => `${line.period}-01` < start)
      .reduce((sum, line) => sum + satangOf(line.amount), 0);
    const within = own
      .filter((line) => `${line.period}-01` >= start && `${line.period}-01` <= end)
      .reduce((sum, line) => sum + satangOf(line.amount), 0);
    const disposedBefore = asset.disposedOn !== null && asset.disposedOn < start;
    const disposedIn = asset.disposedOn !== null && asset.disposedOn >= start && asset.disposedOn <= end;
    if (!disposedBefore) {
      if (asset.acquiredOn < start) {
        m("openingCost", cost);
        m("openingAccumulated", before);
      } else m("additions", cost);
      m("depreciation", within);
      if (disposedIn) {
        m("disposalsCost", cost);
        m("disposalsAccumulated", before + within);
      } else {
        add(cat.assetAccountCode, cost);
        add(cat.accumulatedAccountCode, -(before + within));
      }
    }
    rows.set(cat.code, row);
  }
  const n = (row: Record<string, number | string>, key: string) => row[key] as number;
  const signed = (satang: number) => (satang < 0 ? `-${baht(-satang)}` : baht(satang));
  const reconciliation = [...registerByAccount.entries()]
    .map(([code, register]) => {
      let gl = 0;
      for (const journal of journals)
        if (journal.status === "posted" && journal.entryDate <= end)
          for (const line of journal.lines)
            if (line.accountCode === code) gl += satangOf(line.debit) - satangOf(line.credit);
      return { accountCode: code, register: signed(register), gl: signed(gl), difference: signed(gl - register) };
    })
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  return {
    from,
    to,
    categories: [...rows.values()].map((row) => {
      const closingCost = n(row, "openingCost") + n(row, "additions") - n(row, "disposalsCost");
      const closingAccumulated = n(row, "openingAccumulated") + n(row, "depreciation") - n(row, "disposalsAccumulated");
      return {
        category: String(row.category),
        name: String(row.name),
        openingCost: baht(n(row, "openingCost")),
        additions: baht(n(row, "additions")),
        disposalsCost: baht(n(row, "disposalsCost")),
        closingCost: baht(closingCost),
        openingAccumulated: baht(n(row, "openingAccumulated")),
        depreciation: baht(n(row, "depreciation")),
        disposalsAccumulated: baht(n(row, "disposalsAccumulated")),
        closingAccumulated: baht(closingAccumulated),
        netBookValue: baht(closingCost - closingAccumulated),
      };
    }),
    reconciliation,
  };
}

/* -------------------------------------------------------------------------------------- seed */

// Equipment the founders contributed at start-up (Dr 1510 / Cr 3100), so the bank stays reconciled.
{
  const month = previousMonth();
  register({
    category: categories[0]!,
    name: "โน้ตบุ๊กฝ่ายออกแบบ 2 เครื่อง (ข้อมูลจำลอง)",
    acquiredOn: `${month}-05`,
    cost: 9_600_000,
    residual: 0,
    source: "manual",
    creditAccountCode: "3100",
    vendorInvoiceId: null,
    costCentreCode: "OPS",
    location: "สำนักงานกรุงเทพฯ",
  });
  register({
    category: categories[1]!,
    name: "เครื่องพิมพ์ตัวอย่างงานสี (ข้อมูลจำลอง)",
    acquiredOn: `${month}-12`,
    cost: 18_500_000,
    residual: 500_000,
    source: "manual",
    creditAccountCode: "3100",
    vendorInvoiceId: null,
    costCentreCode: "OPS",
    location: "ห้องตัวอย่างงาน",
  });
  register({
    category: categories[2]!,
    name: "ชุดโต๊ะประชุมและเก้าอี้ (ข้อมูลจำลอง)",
    acquiredOn: `${month}-20`,
    cost: 4_200_000,
    residual: 0,
    source: "manual",
    creditAccountCode: "3100",
    vendorInvoiceId: null,
    costCentreCode: "ADMIN",
    location: "ห้องประชุม",
  });
  // Last month's run is done; this month's waits for Finance (preview → post).
  runDepreciation(month, `${addMonths(month, 1)}-01`);
}

/* ---------------------------------------------------------------------------------- handlers */

const find = (id: string | undefined) => assets.find((asset) => asset.id === id);
const accountOk = (code: string, test: (account: Schemas["AccountDto"]) => boolean) => {
  const account = ACCOUNTS.find((item) => item.code === code);
  return Boolean(account && account.isPostable && account.status === "active" && !account.isControl && test(account));
};

export const assetHandlers = [
  finance.get("/v1/admin/asset-categories", "fixed_assets.read", () => categories),
  finance.post(
    "/v1/admin/asset-categories",
    { permission: "fixed_assets.manage", idempotent: true, status: 201 },
    ({ body }) => {
      const errors: { path: string; code: string; message: string }[] = [];
      if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(body.code ?? ""))
        errors.push({ path: "code", code: "pattern", message: "a–z 0–9 _ -" });
      if (!body.nameTh?.trim()) errors.push({ path: "nameTh", code: "required", message: "ระบุชื่อ" });
      if (!Number.isInteger(body.usefulLifeMonths) || body.usefulLifeMonths < 1)
        errors.push({ path: "usefulLifeMonths", code: "min", message: "อายุการใช้งานอย่างน้อย 1 เดือน" });
      const checks: [keyof typeof body, (a: Schemas["AccountDto"]) => boolean][] = [
        ["assetAccountCode", (a) => a.accountType === "asset" && a.cashFlowClass === "investing"],
        ["accumulatedAccountCode", (a) => a.accountType === "asset" && a.normalSide === "credit"],
        ["expenseAccountCode", (a) => a.accountType === "expense"],
        ["gainLossAccountCode", (a) => ["expense", "revenue"].includes(a.accountType)],
      ];
      for (const [field, test] of checks)
        if (!accountOk(String(body[field] ?? ""), test))
          errors.push({ path: field, code: "fixed_assets.account_invalid", message: "บัญชีนี้ใช้กับช่องนี้ไม่ได้" });
      if (errors.length) return invalid(errors);
      if (categories.some((item) => item.code === body.code))
        return problem(409, "fixed_assets.category_exists", "มีรหัสหมวดนี้แล้ว");
      const created: Category = {
        id: mockId("acat", categories.length + 1),
        code: body.code,
        nameTh: body.nameTh.trim(),
        nameEn: body.nameEn?.trim() || body.nameTh.trim(),
        method: "straight_line",
        usefulLifeMonths: body.usefulLifeMonths,
        assetAccountCode: body.assetAccountCode,
        accumulatedAccountCode: body.accumulatedAccountCode,
        expenseAccountCode: body.expenseAccountCode,
        gainLossAccountCode: body.gainLossAccountCode,
        status: "active",
        rowVersion: 1,
      };
      categories.push(created);
      return created;
    },
  ),
  finance.patch(
    "/v1/admin/asset-categories/{categoryId}",
    { permission: "fixed_assets.manage" },
    ({ params, body, request }) => {
      const item = categories.find((candidate) => candidate.id === params.categoryId);
      if (!item) return notFound("หมวดสินทรัพย์");
      const match = request.headers.get("if-match");
      if (!match) return problem(428, "concurrency.precondition_required", "ต้องส่ง If-Match");
      if (match.replace(/^W\//, "").replaceAll('"', "") !== String(item.rowVersion))
        return problem(412, "concurrency.stale", "มีผู้แก้ไขหมวดนี้ไปแล้ว โหลดใหม่ก่อน");
      if (
        body.usefulLifeMonths !== undefined &&
        (!Number.isInteger(body.usefulLifeMonths) || body.usefulLifeMonths < 1)
      )
        return invalid([{ path: "usefulLifeMonths", code: "min", message: "อายุการใช้งานอย่างน้อย 1 เดือน" }]);
      Object.assign(item, Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined)), {
        rowVersion: item.rowVersion + 1,
      });
      return HttpResponse.json(item, { headers: { etag: `W/"${item.rowVersion}"` } });
    },
  ),
  finance.get("/v1/admin/fixed-assets", "fixed_assets.read", ({ query }) => {
    const rows = assets
      .filter((asset) => !query.status || asset.status === query.status)
      .filter((asset) => !query.categoryId || asset.categoryId === query.categoryId)
      .filter(
        (asset) => !query.q || `${asset.assetNo} ${asset.name}`.toLowerCase().includes(String(query.q).toLowerCase()),
      );
    const page = Number(query.page ?? 1);
    const perPage = Number(query.perPage ?? 25);
    return {
      data: rows.slice((page - 1) * perPage, page * perPage),
      meta: { page, perPage, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / perPage)) },
    };
  }),
  finance.post(
    "/v1/admin/fixed-assets",
    { permission: "fixed_assets.manage", idempotent: true, status: 201 },
    ({ body }) => {
      const cat = categories.find((item) => item.id === body.categoryId && item.status === "active");
      if (!cat) return notFound("หมวดสินทรัพย์");
      const errors: { path: string; code: string; message: string }[] = [];
      if (!body.name?.trim()) errors.push({ path: "name", code: "required", message: "ระบุชื่อสินทรัพย์" });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.acquiredOn ?? ""))
        errors.push({ path: "acquiredOn", code: "date", message: "YYYY-MM-DD" });
      if (!isMoney(body.cost) || satangOf(body.cost) <= 0)
        errors.push({ path: "cost", code: "min", message: "ราคาทุนต้องมากกว่า 0" });
      const residual = body.residualValue ?? "0.00";
      if (!isMoney(residual) || (isMoney(body.cost) && satangOf(residual) >= satangOf(body.cost)))
        errors.push({ path: "residualValue", code: "invalid", message: "มูลค่าซากต้องไม่ติดลบและน้อยกว่าราคาทุน" });
      if (body.source === "manual" && !body.creditAccountCode)
        errors.push({ path: "creditAccountCode", code: "required", message: "ระบุบัญชีที่บันทึกเครดิต" });
      if (body.source === "vendor_bill" && !body.vendorInvoiceId)
        errors.push({ path: "vendorInvoiceId", code: "required", message: "เลือกบิลที่มีรายการสินทรัพย์นี้" });
      if (errors.length) return invalid(errors);
      if (body.source === "manual") {
        if (
          !accountOk(
            body.creditAccountCode!,
            (a) => ["asset", "liability", "equity"].includes(a.accountType) && a.code !== cat.assetAccountCode,
          )
        )
          return invalid([
            { path: "creditAccountCode", code: "fixed_assets.account_invalid", message: "บัญชีนี้บันทึกเครดิตไม่ได้" },
          ]);
      } else {
        const invoice = invoicesAll().find(
          (item) => item.id === body.vendorInvoiceId && ["recorded", "validated"].includes(item.status),
        );
        if (!invoice) return notFound("บิลผู้ขาย");
        const capitalised = invoice.lines
          .filter((line) => line.accountCode === cat.assetAccountCode)
          .reduce((sum, line) => sum + satangOf(line.netAmount), 0);
        const registered = assets
          .filter((asset) => asset.vendorInvoiceId === invoice.id)
          .reduce((sum, asset) => sum + satangOf(asset.cost), 0);
        if (satangOf(body.cost) + registered > capitalised)
          return problem(
            422,
            "fixed_assets.cost_exceeds_bill",
            `บิลนี้บันทึกเป็นสินทรัพย์ ${baht(capitalised)} ขึ้นทะเบียนแล้ว ${baht(registered)}`,
          );
      }
      return register({
        category: cat,
        name: body.name.trim(),
        acquiredOn: body.acquiredOn,
        cost: satangOf(body.cost),
        residual: satangOf(residual),
        source: body.source,
        creditAccountCode: body.source === "manual" ? body.creditAccountCode! : null,
        vendorInvoiceId: body.source === "vendor_bill" ? body.vendorInvoiceId! : null,
        costCentreCode: body.costCentreCode ?? null,
        location: body.location ?? null,
        custodianUserId: body.custodianUserId ?? null,
      });
    },
  ),
  finance.get(
    "/v1/admin/fixed-assets/{assetId}",
    "fixed_assets.read",
    ({ params }) => find(params.assetId) ?? notFound("สินทรัพย์"),
  ),
  finance.get("/v1/admin/fixed-assets/{assetId}/depreciation", "fixed_assets.read", ({ params }) =>
    find(params.assetId)
      ? depreciationLines
          .filter((line) => line.assetId === params.assetId)
          .map(({ assetId: _assetId, ...line }) => line)
      : notFound("สินทรัพย์"),
  ),
  finance.post(
    "/v1/admin/fixed-assets/{assetId}/actions/dispose",
    { permission: "fixed_assets.dispose", idempotent: true },
    ({ params, body }) => {
      const asset = find(params.assetId);
      if (!asset) return notFound("สินทรัพย์");
      if (!["active", "fully_depreciated"].includes(asset.status))
        return problem(409, "fixed_assets.already_disposed", "สินทรัพย์นี้จำหน่ายแล้ว");
      const errors: { path: string; code: string; message: string }[] = [];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.disposedOn ?? ""))
        errors.push({ path: "disposedOn", code: "date", message: "YYYY-MM-DD" });
      else if (body.disposedOn < asset.acquiredOn)
        errors.push({ path: "disposedOn", code: "invalid", message: "ก่อนวันที่ได้มา" });
      if (!body.reason || body.reason.trim().length < 3)
        errors.push({ path: "reason", code: "min", message: "ระบุเหตุผลอย่างน้อย 3 ตัวอักษร" });
      const proceeds =
        body.kind === "written_off" ? 0 : isMoney(body.proceeds ?? "0.00") ? satangOf(body.proceeds ?? "0.00") : -1;
      if (proceeds < 0) errors.push({ path: "proceeds", code: "invalid", message: "จำนวนเงินไม่ถูกต้อง" });
      if (proceeds > 0 && !accountOk(body.proceedsAccountCode ?? "", (a) => a.accountType === "asset"))
        errors.push({ path: "proceedsAccountCode", code: "required", message: "ระบุบัญชีที่รับเงิน" });
      if (errors.length) return invalid(errors);
      const lastMonth = addMonths(body.disposedOn.slice(0, 7), -1);
      const expected = expectedAccumulated(asset, lastMonth);
      if (satangOf(asset.accumulatedDepreciation) !== expected)
        return problem(
          409,
          "fixed_assets.depreciation_pending",
          `ต้องบันทึกค่าเสื่อมราคาถึงงวด ${lastMonth} ก่อน (ควรเป็น ${baht(expected)})`,
        );
      const cat = categories.find((item) => item.id === asset.categoryId)!;
      const cost = satangOf(asset.cost);
      const accumulated = satangOf(asset.accumulatedDepreciation);
      const loss = cost - accumulated - proceeds;
      post({
        rule: "FA03",
        description: `${body.kind === "sold" ? "จำหน่าย" : "ตัดบัญชี"}สินทรัพย์ ${asset.assetNo}: ${body.reason.trim()}`,
        documentDate: body.disposedOn,
        source: { type: "fixed_asset", id: asset.id, number: asset.assetNo },
        lines: [
          { account: cat.accumulatedAccountCode, debit: accumulated },
          ...(proceeds > 0 ? [{ account: body.proceedsAccountCode!, debit: proceeds }] : []),
          loss >= 0
            ? { account: cat.gainLossAccountCode, debit: loss }
            : { account: cat.gainLossAccountCode, credit: -loss },
          { account: cat.assetAccountCode, credit: cost },
        ],
      });
      Object.assign(asset, {
        status: body.kind === "sold" ? "disposed" : "written_off",
        disposedOn: body.disposedOn,
        disposalProceeds: baht(proceeds),
        netBookValue: "0.00",
      });
      return asset;
    },
  ),
  finance.get("/v1/admin/depreciation-runs", "fixed_assets.read", () => depreciationRuns),
  finance.post(
    "/v1/admin/depreciation-runs",
    { permission: "fixed_assets.manage", idempotent: true, status: 201 },
    ({ body }) => {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(body?.period ?? ""))
        return invalid([{ path: "period", code: "pattern", message: "YYYY-MM" }]);
      return runDepreciation(body.period, bangkokIso().slice(0, 10));
    },
  ),
  finance.get("/v1/admin/fixed-assets-reports/roll-forward", "fixed_assets.read", ({ query }) => {
    const from = String(query.from ?? "");
    const to = String(query.to ?? "");
    if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to) || from > to)
      return invalid([{ path: "from", code: "pattern", message: "YYYY-MM ถึง YYYY-MM" }]);
    return rollForward(from, to);
  }),
  // admin.fixedAssets.previewRun (D-150): what the month's run would post; a month already run has no lines.
  finance.get("/v1/admin/depreciation-runs/preview", "fixed_assets.read", ({ query }) => {
    const month = String(query.period ?? "");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
      return invalid([{ path: "period", code: "pattern", message: "YYYY-MM" }]);
    const period = periodOfMonth(month);
    if (!period) return notFound("งวดบัญชี");
    const alreadyRun = depreciationRuns.some((run) => run.period === month);
    const lines = alreadyRun ? [] : dueLines(month);
    return {
      period: month,
      periodStatus: period.status,
      alreadyRun,
      assetCount: lines.length,
      totalAmount: baht(lines.reduce((sum, line) => sum + line.amount, 0)),
      lines: lines.map(({ asset, amount, accumulatedAfter }) => ({
        assetId: asset.id,
        assetNo: asset.assetNo,
        name: asset.name,
        amount: baht(amount),
        accumulatedAfter: baht(accumulatedAfter),
      })),
    };
  }),
];
