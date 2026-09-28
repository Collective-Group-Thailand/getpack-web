/**
 * Collective Group's own bank accounts (D-093), each tied to its cash GL account (112x). Only the
 * last four digits ever leave the API (PDPA). A new account is usable after two different people
 * approve it — Finance, then Finance Manager (policy `company_bank_account_change`, D-169).
 */

import type { Schemas } from "@/lib/api/types";

import { mockId } from "../../support";

export const companyAccounts: Schemas["CompanyBankAccountDto"][] = [
  {
    id: mockId("cba", 1),
    bankCode: "014",
    accountName: "บริษัท คอลเลคทีฟ กรุ๊ป (ประเทศไทย) จำกัด (ข้อมูลจำลอง)",
    accountNoLast4: "4417",
    branchName: "สาขาตัวอย่าง",
    purpose: "both",
    glAccountCode: "1121",
    defaultBulkFormat: "scb_bulk_csv",
    status: "active",
    approvalRequestId: null,
  },
  {
    id: mockId("cba", 2),
    bankCode: "004",
    accountName: "บริษัท คอลเลคทีฟ กรุ๊ป (ประเทศไทย) จำกัด (ข้อมูลจำลอง)",
    accountNoLast4: "9032",
    branchName: "สาขาตัวอย่าง",
    purpose: "collection",
    glAccountCode: "1122",
    defaultBulkFormat: "kbank_bulk_csv",
    status: "active",
    approvalRequestId: null,
  },
];

/** The bank-file formats a run can be written in (one adapter per bank, a generic CSV fallback). */
export const BULK_FORMATS = ["scb_bulk_csv", "kbank_bulk_csv", "generic_csv"] as const;
