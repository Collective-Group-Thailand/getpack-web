"use client";

import { useRouter } from "next/navigation";

import type { SignInLinks } from "@/features/shared/customer-auth/links";
import { SignInFlow } from "@/features/shared/customer-auth/SignInFlow";

/**
 * getpack Agent's sign-in (D-467): the storefront's own flow — phone OTP, Google, Apple, LINE — sending
 * `client: "agent"`, so this device's session is a getpack Agent session of its own. The PDPA consent step runs as
 * everywhere; the shop's name-and-type step does not.
 */
export function AgentSignIn({
  returnTo,
  resume,
  lineReturnUrl,
  links,
  heading,
}: {
  returnTo: string;
  resume?: "line";
  lineReturnUrl: string;
  links: SignInLinks;
  heading: { title: string; subtitle: string };
}) {
  const router = useRouter();
  return (
    <SignInFlow
      variant="page"
      client="agent"
      askProfile={false}
      links={links}
      heading={heading}
      resume={resume}
      lineReturnUrl={lineReturnUrl}
      onSignedIn={() => {
        router.replace(returnTo);
        router.refresh();
      }}
    />
  );
}
