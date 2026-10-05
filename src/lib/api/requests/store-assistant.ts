/**
 * The assistant's availability for the storefront (U5.5): whether the signed-in customer can start
 * a session now. packio-api decides it (`assistant.enabled`, the D-306 gate, D-305 limits) but has no
 * store read of it at v0.41.0 — the only way to learn it is to start a session and be refused, which
 * would show a launcher that then says "not available". Signed-in only.
 */

import { z } from "zod";

import { request } from "./define";

export const assistantAvailability = z
  .object({
    available: z.boolean(),
    /** Why not, when not: switched off, not configured (no provider or cost ceiling), or a limit reached. */
    reason: z
      .enum(["disabled", "not_configured", "rate_limited"])
      .nullable()
      .meta({ id: "AssistantUnavailableReason" }),
    /** `assistant.log_retention_days` (D-305), for the panel's privacy note; null when unset. */
    logRetentionDays: z.number().int().nullable(),
  })
  .meta({ id: "AssistantAvailabilityDto" });

export const storeAssistantRequests = {
  "GET /v1/store/assistant/availability": request({
    request: "store.assistant-availability",
    summary: "Whether the assistant can be used by me now, and why not",
    decisions: ["D-218", "D-305", "D-306"],
    response: assistantAvailability,
  }),
} as const;
