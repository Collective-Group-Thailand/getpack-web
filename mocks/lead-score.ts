/**
 * The mock's lead score (D-471): a stand-in for getpack-api's `scoreLead` with the proposed seed of
 * `sales.scoring_rules` (API-CHANGES-P5 §2), so the inbox, the pipeline and the agent zone show plausible,
 * deterministic numbers and reasons. Mock-only — the web never scores; it renders what the API sends.
 */

import type { Schemas } from "@/lib/api/types";

type Reason = Schemas["SalesScoreReasonDto"];
type ReasonKey = Schemas["SalesScoreReason"];

const ORDER: ReasonKey[] = [
  "source",
  "company_email_domain",
  "free_email_domain",
  "tax_id_present",
  "quantity_band",
  "value_band",
  "recency",
  "repeat_signals",
];
const INBOUND_SOURCE: Record<string, number> = {
  contact_form: 15,
  rfq: 20,
  line_chat: 10,
  manual: 10,
  studio_idle: 10,
  dieline_download: 5,
};
const LEAD_SOURCE: Record<string, number> = { manual: 5, card_scan: 10, csv_import: 0, link: 15, staff: 10 };
const FREE_MAIL = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com", "hotmail.co.th"];

export interface MockScoreInput {
  kind: "inbound" | "lead";
  source: string;
  email: string | null;
  taxIdPresent?: boolean;
  quantity?: number | null;
  value?: string | null;
  lastAt: string;
  signals?: number;
}

export function mockLeadScore(input: MockScoreInput): { score: number; reasons: Reason[] } {
  const found: Reason[] = [];
  const add = (reason: ReasonKey, points: number | undefined) => {
    if (points) found.push({ reason, points });
  };
  add("source", (input.kind === "inbound" ? INBOUND_SOURCE : LEAD_SOURCE)[input.source]);
  const domain = input.email?.split("@")[1]?.toLowerCase();
  if (domain) {
    if (FREE_MAIL.includes(domain)) add("free_email_domain", -5);
    // `example.invalid` is the mock's own placeholder domain: counted as a company address.
    else add("company_email_domain", 15);
  }
  if (input.taxIdPresent) add("tax_id_present", 15);
  const q = input.quantity ?? 0;
  add("quantity_band", q >= 20000 ? 15 : q >= 5000 ? 10 : q >= 1000 ? 5 : undefined);
  const v = Number(input.value ?? 0);
  add("value_band", v >= 500000 ? 15 : v >= 100000 ? 10 : v >= 20000 ? 5 : undefined);
  const days = (Date.now() - Date.parse(input.lastAt)) / 86_400_000;
  add("recency", days <= 1 ? 15 : days <= 7 ? 10 : days <= 30 ? 5 : undefined);
  if ((input.signals ?? 1) >= 3) add("repeat_signals", 5);
  const score = Math.min(100, Math.max(0, Math.round(10 + found.reduce((sum, r) => sum + r.points, 0))));
  const reasons = found
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points) || ORDER.indexOf(a.reason) - ORDER.indexOf(b.reason))
    .slice(0, 3);
  return { score, reasons };
}

/** An agent lead's score from its own fields (what the API's `scoreAgentLead` reads). */
export function mockAgentLeadScore(lead: {
  source: string;
  email: string | null;
  taxId: string | null;
  expectedValue: string | null;
  createdAt: string;
  stageChangedAt: string | null;
}) {
  const last =
    lead.stageChangedAt && Date.parse(lead.stageChangedAt) > Date.parse(lead.createdAt)
      ? lead.stageChangedAt
      : lead.createdAt;
  return mockLeadScore({
    kind: "lead",
    source: lead.source,
    email: lead.email,
    taxIdPresent: Boolean(lead.taxId),
    value: lead.expectedValue,
    lastAt: last,
  });
}
