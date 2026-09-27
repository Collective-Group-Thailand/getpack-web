import type { Schemas } from "@/lib/api/types";

export type OnboardingStep = Schemas["OnboardingStep"];

/** The thirteen steps of D-011, in the order the API returns them. */
export const ONBOARDING_STEPS = [
  "application",
  "kyc",
  "bank_account",
  "capability",
  "capacity",
  "delivery_zones",
  "pricing_arrangement",
  "tolerance",
  "payout_policy",
  "agreement",
  "site_visit",
  "trial",
  "activation",
] as const satisfies readonly OnboardingStep[];

export const isOnboardingStep = (value: string): value is OnboardingStep =>
  (ONBOARDING_STEPS as readonly string[]).includes(value);

/** The factory's path to activation (D-011): applied → review → trial → active. */
export const FACTORY_STAGES = ["applied", "under_review", "trial", "active"] as const;

/** A staff-entered step the factory has not signed off yet (the D-100 note). */
export const awaitsSignOff = (step: Schemas["OnboardingStepDto"]) => step.enteredByStaff && !step.factorySignedOffAt;
