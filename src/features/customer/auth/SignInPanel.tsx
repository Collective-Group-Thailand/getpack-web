"use client";

import { useRouter } from "@/i18n/navigation";

import { SignInFlow } from "./SignInFlow";

/**
 * The sign-in flow as the `/sign-in` page's form — for the cases that need a URL: a guard
 * sending someone here with a `returnTo`, a link in an SMS or LINE message, the cart's checkout
 * button, and the LIFF entry point. Signing in goes back to `returnTo`; the guest cart, if any,
 * joins the account when the cart page next loads (`useGuestCartMerge`).
 */
export function SignInPanel({
  returnTo,
  resume,
  lineReturnUrl,
}: {
  returnTo: string;
  resume?: "line";
  lineReturnUrl?: string;
}) {
  const router = useRouter();

  return (
    <SignInFlow
      variant="page"
      resume={resume}
      lineReturnUrl={lineReturnUrl}
      onSignedIn={() => {
        router.replace(returnTo);
        // The guard that sent them here runs on the server, so the new cookie only takes
        // effect once this route's server components re-render.
        router.refresh();
      }}
    />
  );
}
