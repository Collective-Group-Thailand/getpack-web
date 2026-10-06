/**
 * Two storefront reads and one write the page patterns need (U-F3, F3 page patterns §Home 8):
 * the operating company's registered identity for the footer (D-092 keeps the registered name, tax
 * id and branch in settings, which the store cannot read), and a guest's newsletter sign-up with
 * its PDPA consent (signed-in customers already consent through `store.me.recordConsent`).
 */

import { z } from "zod";

import { request } from "./define";

export const companyIdentity = z
  .object({
    legalNameTh: z.string(),
    legalNameEn: z.string(),
    taxId: z.string().regex(/^\d{13}$/),
    /** "สำนักงานใหญ่" or the branch number, as printed on tax documents. */
    branch: z.string(),
    addressTh: z.string(),
    addressEn: z.string().nullable(),
  })
  .meta({ id: "StoreCompanyIdentityDto" });

export const newsletterSignUp = z
  .object({
    email: z.string().email().max(254),
    /** The box was ticked: consent to `marketing_email` (PDPA); packio-api records its current text version. */
    marketingConsent: z.literal(true),
  })
  .meta({ id: "NewsletterSignUpDto" });

export const storeHomeRequests = {
  "GET /v1/store/company-identity": request({
    request: "store.company-identity",
    summary: "The operating company as printed on tax documents: registered name, tax id, branch, address",
    decisions: ["D-092"],
    response: companyIdentity,
    public: true,
  }),
  "POST /v1/store/newsletter/actions/subscribe": request({
    request: "store.newsletter-subscribe",
    summary: "A guest signs up for the newsletter with the marketing-email consent version they saw",
    decisions: ["D-181"],
    body: newsletterSignUp,
    status: 204,
    public: true,
  }),
} as const;
