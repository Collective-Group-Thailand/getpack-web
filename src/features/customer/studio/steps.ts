/**
 * The studio's five steps (studio-spec §2): one URL, the step in `?step=`, every step reversible.
 * ④ Check and ⑤ Order open as soon as the design has content; ② onwards needs a box.
 */
export const STUDIO_STEPS = ["start", "box", "design", "check", "order"] as const;
export type StudioStep = (typeof STUDIO_STEPS)[number];

export const isStudioStep = (value: unknown): value is StudioStep =>
  typeof value === "string" && (STUDIO_STEPS as readonly string[]).includes(value);

export interface StepFacts {
  hasBox: boolean;
  hasContent: boolean;
}

/** Why a step cannot be opened yet, or `null` when it can. */
export function lockedReason(step: StudioStep, facts: StepFacts): "needsBox" | "needsContent" | null {
  if (step === "start") return null;
  if (!facts.hasBox) return "needsBox";
  if ((step === "check" || step === "order") && !facts.hasContent) return "needsContent";
  return null;
}

/**
 * The step a studio opens on: the one asked for when it is open, else the furthest open step at or
 * before it — a design with a box but nothing on it lands on ③, a new one on ①.
 */
export function initialStep(asked: unknown, facts: StepFacts): StudioStep {
  const wanted: StudioStep = isStudioStep(asked) ? asked : facts.hasBox ? "design" : "start";
  for (let i = STUDIO_STEPS.indexOf(wanted); i >= 0; i--) {
    const step = STUDIO_STEPS[i]!;
    if (!lockedReason(step, facts)) return step;
  }
  return "start";
}
