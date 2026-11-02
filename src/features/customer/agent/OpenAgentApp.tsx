"use client";

import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";

import { Button } from "@/ui/components/Button";

import { openAgentApp } from "./handoff";

function Submit({ variant }: { variant: "primary" | "secondary" }) {
  const t = useTranslations("account.home");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} iconEnd="external" loading={pending}>
      {t("agentAppAction")}
    </Button>
  );
}

/** "เปิด getpack Agent": a form, so it works before the page hydrates (D-467 hand-off). */
export function OpenAgentApp({ to = "/", variant = "primary" }: { to?: string; variant?: "primary" | "secondary" }) {
  return (
    <form action={openAgentApp} className="contents">
      <input type="hidden" name="to" value={to} />
      <Submit variant={variant} />
    </form>
  );
}
