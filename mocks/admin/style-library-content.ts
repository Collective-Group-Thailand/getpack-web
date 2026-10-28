/**
 * The style library page content staff keep (`admin.styleLibrary.getSettings` / `updateSettings`,
 * D-448) — held in memory so the back-office editor and the storefront read the same thing in
 * `pnpm dev:mock`. Starts with the mock's own quick-search examples and an empty trust section: the
 * mock never pretends to hold certificates, photos or customer logos.
 */

import { http, HttpResponse, type HttpHandler } from "msw";

import type { Schemas } from "@/lib/api/types";

import { bangkokIso, mockId } from "../support";

type Content = Schemas["StyleLibraryContentDto"];

const initial = (): Content => ({
  quickSearch: [
    { label: { th: "เมลเลอร์", en: "Mailer" }, query: "เมลเลอร์" },
    { label: { th: "แม่เหล็ก", en: "Magnetic" }, query: "แม่เหล็ก" },
    { label: { th: "กล่องเค้ก", en: "Cake box" }, query: "กล่องเค้ก" },
    { label: { th: "กล่องผลไม้", en: "Fruit box" }, query: "กล่องผลไม้" },
  ],
  materialSwatches: [],
  trust: { certifications: [], foodGrade: [], productionPhotos: [], customerLogos: [], taxInvoiceNote: null },
});

let content: Content = initial();
let version: { no: number; at: string } | null = null;

/** The content in force (the storefront mock reads it too). */
export function styleLibraryContent(): Content {
  return content;
}

/** Tests: back to the start. */
export function resetStyleLibraryContent(): void {
  content = initial();
  version = null;
}

const SETTING_ID = mockId("set", 448);

const adminView = (): Schemas["AdminStyleLibrarySettingsDto"] => ({
  content,
  versionNo: version?.no ?? null,
  effectiveFrom: version?.at ?? null,
  settingId: SETTING_ID,
});

export const styleLibraryContentHandlers: HttpHandler[] = [
  http.get("*/v1/admin/style-library/settings", () => HttpResponse.json(adminView())),
  http.put("*/v1/admin/style-library/settings", async ({ request }) => {
    const body = (await request.json()) as Schemas["UpdateStyleLibrarySettingsDto"];
    content = body.content;
    version = { no: (version?.no ?? 0) + 1, at: bangkokIso() };
    return HttpResponse.json(adminView());
  }),
];
