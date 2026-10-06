"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { signOut } from "@/features/shared/auth/sign-out";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";

const SignInSheet = dynamic(() => import("./SignInSheet").then((module) => module.SignInSheet), { ssr: false });

/**
 * The header's account control. Signed in, it opens a menu — บัญชีของฉัน · คำสั่งซื้อ ·
 * ออกจากระบบ (round 2, B9: a customer had no way to sign out). Signed out, it links to
 * `/sign-in?returnTo=<this page>` directly — no detour through `/account`'s redirect (UX audit
 * Flow 1, bug #4), and it works without JavaScript — but once the page is interactive it opens
 * the sign-in sheet over the page instead, so signing in does not lose the customer's place. The
 * sheet's code loads on that first click.
 */
export function AccountButton({
  signedIn,
  label,
  signInLabel,
}: {
  signedIn: boolean;
  label: string;
  /** Signed out on a desktop, show this text link ("เข้าสู่ระบบ") in place of the account icon. */
  signInLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // The path only: reading the query here would opt every page out of static rendering.
  const here = pathname;
  const href = signedIn
    ? "/account"
    : here === "/" || here.startsWith("/sign-in")
      ? "/sign-in"
      : `/sign-in?returnTo=${encodeURIComponent(here)}`;
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const t = useTranslations("auth");
  const [leaving, startLeaving] = useTransition();

  function openSheet(event: React.MouseEvent) {
    if (signedIn || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setLoaded(true);
    setOpen(true);
  }

  // The sign-in sheet stays mounted when the session starts: the header turns signed-in as soon as
  // the OTP is verified, while the sheet still has the consent and profile steps to show.
  const sheet = loaded ? (
    <SignInSheet
      open={open}
      onOpenChange={setOpen}
      onSignedIn={() => {
        setOpen(false);
        // Server components read the session cookie; re-render them with it.
        router.refresh();
      }}
    />
  ) : null;

  const control = signedIn ? (
    <DropdownMenu
      label={label}
      align="end"
      trigger={<IconButton name="user" variant="ghost" size="sm" label={label} loading={leaving} />}
      items={[
        { id: "account", label: t("menu.account"), icon: "dashboard", onSelect: () => router.push("/account") },
        { id: "orders", label: t("menu.orders"), icon: "package", onSelect: () => router.push("/account/orders") },
        {
          id: "sign-out",
          label: t("signOut"),
          icon: "log-out",
          tone: "destructive",
          separatorBefore: true,
          onSelect: () => startLeaving(() => signOut("customer")),
        },
      ]}
    />
  ) : (
    <>
      {signInLabel ? (
        <Link
          href={href}
          onClick={openSheet}
          className="text-fg/85 hover:bg-bg-subtle hover:text-fg focus-visible:ring-focus-ring hidden h-10 items-center rounded-lg px-2.5 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 lg:inline-flex"
        >
          {signInLabel}
        </Link>
      ) : null}
      <IconButton
        asChild
        name="user"
        variant="ghost"
        size="sm"
        label={label}
        className={signInLabel ? "lg:hidden" : undefined}
      >
        <Link href={href} onClick={openSheet} />
      </IconButton>
    </>
  );

  // The sheet keeps its place whichever control shows, so React keeps it mounted across sign-in.
  return (
    <>
      {control}
      {sheet}
    </>
  );
}
