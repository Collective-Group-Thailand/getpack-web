"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/ui";
import type { Zone } from "@/lib/zones";

import { signOut } from "./sign-out";

export function SignOutButton({ zone, variant = "ghost" }: { zone: Zone; variant?: "ghost" | "secondary" }) {
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={variant}
      iconStart="log-out"
      loading={pending}
      onClick={() => startTransition(() => signOut(zone))}
    >
      {t("signOut")}
    </Button>
  );
}
