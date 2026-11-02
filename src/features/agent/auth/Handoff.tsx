"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { safeReturnTo } from "@/features/shared/auth/return-to";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Spinner } from "@/ui/components/Spinner";

import { redeemHandoff } from "./redeem";

/** `#code=…&to=…` → its parts. The fragment never reaches a server, which is why the code travels in it. */
export function readFragment(hash: string): { code: string | null; to: string } {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return { code: params.get("code"), to: safeReturnTo(params.get("to")) };
}

/**
 * The landing of "เปิด getpack Agent" (D-467): reads the one-time code from the URL fragment, wipes it from the
 * address bar and history at once, has this host's server redeem it, and opens the app signed in. A spent, expired
 * or copied code shows one neutral line and the way to sign in instead.
 */
export function Handoff() {
  const t = useTranslations("agentZone.handoff");
  const tProblems = useTranslations("problems");
  const [failed, setFailed] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const { code, to } = readFragment(window.location.hash);
    window.history.replaceState(null, "", window.location.pathname);
    if (!code) {
      window.location.replace("/sign-in");
      return;
    }
    void redeemHandoff(code).then((result) => {
      if (result.ok) window.location.replace(to);
      else setFailed(result.code);
    });
  }, []);

  if (failed) {
    return (
      <EmptyState
        icon="lock"
        titleAs="h1"
        title={t("failedTitle")}
        description={tProblems.has(failed) ? tProblems(failed) : t("failedBody")}
        action={
          <Button asChild>
            <Link href="/sign-in">{t("signIn")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <Spinner size={32} label={null} />
      <h1 className="text-xl font-semibold">{t("opening")}</h1>
      <p className="text-muted">{t("openingBody")}</p>
    </div>
  );
}
