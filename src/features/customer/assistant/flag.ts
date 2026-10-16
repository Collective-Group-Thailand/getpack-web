/**
 * Whether getpack Assistant is built into this deployment (`NEXT_PUBLIC_ASSISTANT=1`). D-218 keeps it
 * off at launch, so a production build carries none of its code; getpack-api still decides per
 * customer when it is built in (`assistant.enabled`, the D-306 evaluation gate).
 */
export const ASSISTANT_BUILT_IN = process.env.NEXT_PUBLIC_ASSISTANT === "1";
