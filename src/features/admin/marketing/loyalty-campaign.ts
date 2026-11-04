/**
 * Loyalty P3 (D-499): the admin points campaign draft and how it becomes `admin.loyaltyCampaigns.create` / `update`'s
 * body. The API validates again (window ≤ 92 days, ×1.01–5.00, the D-494 audience rules, 409
 * `loyalty.campaign_started` once it has begun); the ×3.00 combined cap applies at earning, not here.
 */

import type { AdminLoyaltyCampaignRule, LoyaltyCampaignInput } from "@/features/shared/loyalty-p3/types";

import { audienceDraftOf, audienceOf, type AudienceDraft } from "./audience";
import { bangkokDayOf, bangkokMidnight } from "./time";

export interface CampaignDraft {
  name: string;
  multiplier: string;
  startsOn: string;
  endsOn: string;
  productTypeCodes: string[];
  audience: AudienceDraft;
  reason: string;
}

export const blankCampaignDraft = (): CampaignDraft => ({
  name: "",
  multiplier: "1.50",
  startsOn: "",
  endsOn: "",
  productTypeCodes: [],
  audience: audienceDraftOf(null),
  reason: "",
});

export function campaignDraftOf(campaign: AdminLoyaltyCampaignRule): CampaignDraft {
  return {
    name: campaign.name ?? "",
    multiplier: campaign.multiplier,
    startsOn: bangkokDayOf(campaign.startsAt),
    endsOn: bangkokDayOf(campaign.endsAt),
    productTypeCodes: campaign.productTypeCodes ?? [],
    // The campaign audience is conditions v2's (D-494); the picker is the promotion editor's.
    audience: audienceDraftOf(campaign.audience),
    reason: campaign.reason ?? "",
  };
}

export type CampaignProblem = "name" | "multiplier" | "startsOn" | "endsOn" | "reason";

export function campaignProblems(draft: CampaignDraft): CampaignProblem[] {
  const problems: CampaignProblem[] = [];
  if (draft.name.trim().length < 3) problems.push("name");
  const multiplier = /^\d(\.\d{1,2})?$/.test(draft.multiplier.trim()) ? Number(draft.multiplier) : NaN;
  if (!(multiplier >= 1.01 && multiplier <= 5)) problems.push("multiplier");
  if (!draft.startsOn) problems.push("startsOn");
  if (!draft.endsOn || (draft.startsOn && draft.endsOn < draft.startsOn)) problems.push("endsOn");
  if (!/^[a-z0-9_]{3,40}$/.test(draft.reason)) problems.push("reason");
  return problems;
}

export function campaignInputOf(draft: CampaignDraft): LoyaltyCampaignInput {
  return {
    name: draft.name.trim(),
    kind: "admin_rule",
    // "1.5" → "1.50": the contract's two decimals.
    multiplier: Number(draft.multiplier).toFixed(2),
    startsAt: bangkokMidnight(draft.startsOn),
    endsAt: bangkokMidnight(draft.endsOn, true),
    productTypeCodes: draft.productTypeCodes.length ? [...draft.productTypeCodes] : null,
    audience: audienceOf(draft.audience) ?? null,
    reason: draft.reason.trim(),
  };
}

/** The API's field path as the form field it lands on. */
export function campaignFieldOfPath(path: string): CampaignProblem | null {
  if (path === "name" || path === "multiplier" || path === "reason") return path;
  if (path === "startsAt") return "startsOn";
  if (path === "endsAt") return "endsOn";
  return null;
}

/** Whether an admin rule campaign may still be edited: before it starts (the API refuses after). */
export const isEditableCampaign = (startsAt: string, status: string, now: number) =>
  status !== "cancelled" && status !== "ended" && Date.parse(startsAt) > now;
