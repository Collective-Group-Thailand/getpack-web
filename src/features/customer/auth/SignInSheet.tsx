"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

import { Dialog } from "@/ui/components/Dialog";
import { Sheet } from "@/ui/components/Sheet";

import { SignInFlow } from "./SignInFlow";

export interface SignInSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once a session exists and the onboarding steps are done. */
  onSignedIn?: () => void;
  /** Back from LINE's login page (`/sign-in?provider=line`): finish that sign-in on open. */
  resume?: "line";
  /** Where LINE should send the customer back to after its login page. */
  lineReturnUrl?: string;
}

const WIDE = "(min-width: 48rem)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Sign-in over the page the customer is on, so they keep their place: a centred 480 px dialog
 * from `md` up, the bottom sheet below it, in the thumb zone (UX audit Flow 1, step 3:
 * "≥ md ใช้ centered dialog 480px; < md ใช้ bottom sheet"). The flow inside is `SignInFlow`, the
 * same one the `/sign-in` page shows.
 */
export function SignInSheet({ open, onOpenChange, onSignedIn, resume, lineReturnUrl }: SignInSheetProps) {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const wide = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
  const [step, setStep] = useState<"phone" | "otp" | "onboarding">("phone");
  const onStepChange = useCallback((next: "phone" | "otp" | "onboarding") => setStep(next), []);

  const title = t("customer.title");
  const description = step === "phone" ? t("customer.subtitle") : undefined;
  const flow = (
    <SignInFlow
      variant="overlay"
      onSignedIn={onSignedIn}
      resume={open ? resume : undefined}
      lineReturnUrl={lineReturnUrl}
      onStepChange={onStepChange}
    />
  );

  return wide ? (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      closeLabel={tCommon("actions.close")}
      className="max-w-[30rem]"
    >
      {flow}
    </Dialog>
  ) : (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side="bottom"
      title={title}
      description={description}
      closeLabel={tCommon("actions.close")}
    >
      {flow}
    </Sheet>
  );
}
