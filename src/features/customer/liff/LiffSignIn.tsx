"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { signInWithLine } from "@/features/customer/auth/actions";
import { lineConfigured } from "@/features/customer/auth/providers";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Spinner } from "@/ui/components/Spinner";

/**
 * Signing in inside LINE (D-151): with a LIFF id, the LIFF SDK hands over the LINE identity and
 * the session starts without a form; without one (or outside LINE), the phone sign-in, then back.
 */
export function LiffSignIn() {
  const t = useTranslations("liff.signIn");
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<"working" | "manual" | "failed">(lineConfigured() ? "working" : "manual");

  useEffect(() => {
    if (!lineConfigured()) return;
    let cancelled = false;
    void (async () => {
      try {
        const { lineIdentity } = await import("@/features/customer/auth/provider-sdks");
        const identity = await lineIdentity(window.location.href);
        if (!identity || cancelled) return;
        const result = await signInWithLine(identity);
        if (cancelled) return;
        if ("ok" in result) router.refresh();
        else setState("failed");
      } catch {
        if (!cancelled) setState("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      {state === "working" ? (
        <>
          <Spinner label={null} />
          <p className="text-muted" role="status">
            {t("working")}
          </p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold">{t("title")}</h1>
          {state === "failed" ? (
            <Callout tone="warning">{t("failed")}</Callout>
          ) : (
            <p className="text-muted">{t("intro")}</p>
          )}
          <Button asChild>
            <Link href={`/sign-in?returnTo=${encodeURIComponent(pathname)}`}>{t("phone")}</Link>
          </Button>
        </>
      )}
    </div>
  );
}
