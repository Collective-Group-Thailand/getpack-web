/**
 * The home page's two contract requests (U-F3): the operating company's identity for the footer
 * (D-092 — obviously fake values here) and a guest's newsletter sign-up, kept in memory.
 */

import { mockRequest } from "../route";

export const newsletterSignUps: string[] = [];

export const homeHandlers = [
  // CONTRACT-REQUEST store.company-identity
  mockRequest("GET /v1/store/company-identity", () => ({
    legalNameTh: "บริษัท คอลเลคทีฟ กรุ๊ป (ประเทศไทย) จำกัด (ข้อมูลจำลอง)",
    legalNameEn: "Collective Group (Thailand) Co., Ltd. (mock)",
    taxId: "0000000000000",
    branch: "สำนักงานใหญ่",
    addressTh: "ที่อยู่จดทะเบียน (ข้อมูลจำลอง) กรุงเทพมหานคร 10110",
    addressEn: null,
  })),
  // CONTRACT-REQUEST store.newsletter-subscribe
  mockRequest("POST /v1/store/newsletter/actions/subscribe", ({ body }) => {
    if (!newsletterSignUps.includes(body.email)) newsletterSignUps.push(body.email);
    return undefined as never;
  }),
];
