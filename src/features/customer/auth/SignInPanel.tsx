"use client";

import { useRouter } from "@/i18n/navigation";
import { useState } from "react";

import { SignInSheet } from "./SignInSheet";

/**
 * The sign-in sheet on a page of its own.
 *
 * Customers normally sign in from wherever they are — the sheet opens over the cart, the
 * configurator, an order. This page exists for the cases that need a URL: a guard sending
 * someone here with a `returnTo`, a link in an SMS or LINE message, and the LIFF entry point
 * F3 adds.
 */
export function SignInPanel({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  return (
    <SignInSheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Closing is a cancel. Going back is the kind thing to do when there is somewhere to
        // go back to — arriving here straight from an SMS link, there is not, and `back()`
        // would land on `about:blank`.
        if (!next) {
          if (window.history.length > 1) router.back();
          else router.replace("/");
        }
      }}
      onSignedIn={() => {
        router.replace(returnTo);
        // The guard that sent them here runs on the server, so the new cookie only takes
        // effect once this route's server components re-render.
        router.refresh();
      }}
    />
  );
}
