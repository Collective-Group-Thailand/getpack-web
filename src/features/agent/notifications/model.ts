import type { Schemas } from "@/lib/api/types";

/** Plain values (not a client module), so the server page and the client switches read the same lists. */
export type Preferences = Schemas["AgentNotificationPreferencesDto"];
export type Event = Schemas["AgentNotificationEvent"];
export type Channel = Schemas["PartnerNotificationChannel"];

/** The order an agent reads them in: their leads, their money, the paperwork around it. */
export const EVENTS: readonly Event[] = [
  "lead_converted",
  "lead_protection_expiring",
  "follow_up_due",
  "quote_opened",
  "commission_earned",
  "statement_ready",
  "payout_paid",
  "payout_profile_needed",
];
export const CHANNELS: readonly Channel[] = ["web_push", "line", "email"];

/** Whether a channel can reach this person at all, from `reachable`. */
export function reachableFor(reachable: Preferences["reachable"], channel: Channel): boolean {
  return channel === "web_push" ? reachable.webPush : channel === "line" ? reachable.line : reachable.email;
}
