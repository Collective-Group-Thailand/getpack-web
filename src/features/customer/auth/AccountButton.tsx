"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { IconButton } from "@/ui/components/IconButton";

const SignInSheet = dynamic(() => import("./SignInSheet").then((module) => module.SignInSheet), { ssr: false });

/**
 * The header's account control. Signed in, it is a link to the account. Signed out, it is still
 * that link — `/account` sends a guest to `/sign-in`, so it works without JavaScript — but once
 * the page is interactive it opens the sign-in sheet over the page instead, so signing in does
 * not lose the customer's place. The sheet's code loads on that first click.
 */
export function AccountButton({ signedIn, label }: { signedIn: boolean; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <IconButton asChild name="user" variant="ghost" size="sm" label={label}>
        <Link
          href="/account"
          onClick={(event) => {
            if (signedIn || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            setLoaded(true);
            setOpen(true);
          }}
        />
      </IconButton>
      {loaded ? (
        <SignInSheet
          open={open}
          onOpenChange={setOpen}
          onSignedIn={() => {
            setOpen(false);
            // Server components read the session cookie; re-render them with it.
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
