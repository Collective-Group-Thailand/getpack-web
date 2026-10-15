import type { Schemas } from "@/lib/api/types";

type Progress = Schemas["OrderProgressDto"];
/** What `OrderStages` reads of a step — the API's step, or one built from the journey. */
export type JourneyStep = Pick<
  Schemas["ProgressStepDto"],
  "key" | "labelTh" | "labelEn" | "completedAt" | "promisedAt" | "status"
>;

/** The customer's journey through an order, in the order the API's timestamps are set. */
const JOURNEY = [
  { key: "placed", at: () => "placed" as const },
  { key: "paid", at: (p: Progress) => p.paidForProductionAt },
  { key: "artwork", at: (p: Progress) => p.artworkApprovedAt },
  { key: "production", at: (p: Progress) => p.productionStartedAt },
  { key: "shipped", at: (p: Progress) => p.shippedAt, promised: (p: Progress) => p.promisedShipDate },
  { key: "delivered", at: (p: Progress) => p.deliveredAt, promised: (p: Progress) => p.estimatedDeliveryDate },
  { key: "completed", at: (p: Progress) => p.completedAt },
] as const;

export type JourneyKey = (typeof JOURNEY)[number]["key"];

/**
 * The stages to show for an order. The API lists production stages (`steps`) only once a factory
 * holds the job; before that — waiting for payment, for the artwork — a customer saw no tracker at
 * all, which is exactly when they ask "where am I?" (owner walkthrough 2026-10-14). The API's own
 * steps win when it has them; otherwise the journey is read off the progress timestamps: every
 * stage with a time is done, the first without is current, the rest are to come, and a cancelled
 * order skips what it never reached. Dates come from the API; nothing is computed here. Labels
 * come from `src/i18n` (`fulfilment.journey`), in the reader's language.
 */
export function journeySteps(
  progress: Progress,
  placedAt: string,
  label: (key: JourneyKey) => string,
): JourneyStep[] {
  if (progress.steps.length > 0) return progress.steps;
  const cancelled = progress.status === "cancelled";
  let currentSeen = false;
  return JOURNEY.map((stage) => {
    const raw = stage.at(progress);
    const completedAt = raw === "placed" ? placedAt : raw;
    const promisedAt = "promised" in stage ? stage.promised(progress) : null;
    let status: JourneyStep["status"];
    if (completedAt) status = "completed";
    else if (cancelled) status = "skipped";
    else if (!currentSeen) {
      status = "in_progress";
      currentSeen = true;
    } else status = "pending";
    const text = label(stage.key);
    return { key: stage.key, labelTh: text, labelEn: text, completedAt, promisedAt, status };
  });
}
