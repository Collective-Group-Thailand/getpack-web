"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";

/**
 * A signed-in friend uses the referral code (D-136, `store.referral.attribute`: once per account, before the
 * first order). Pressed — or at once when they come back from signing in through this page (`auto`). The API's own
 * problem wording is shown when it refuses (own code, already used, not a new customer, unknown code).
 */
export function ReferralClaim({ code, auto }: { code: string; auto: boolean }) {
  const t = useTranslations("account.referral.landing");
  const [state, setState] = useState<{ status: "idle" | "busy" | "done" } | { status: "error"; message: string }>({
    status: "idle",
  });
  const started = useRef(false);

  const claim = async () => {
    setState({ status: "busy" });
    try {
      await browserApi().POST("/v1/store/referral/attribution", { body: { code } });
      setState({ status: "done" });
    } catch (error) {
      setState({ status: "error", message: isApiError(error) ? error.detail : t("failed") });
    }
  };

  useEffect(() => {
    if (!auto || started.current) return;
    started.current = true;
    void claim();
    // Once, on arrival from sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  if (state.status === "done")
    return (
      <div className="flex w-full flex-col items-center gap-3">
        <Callout tone="success" live title={t("claimed")} className="w-full text-start" />
        <Button asChild size="lg">
          <Link href="/products">{t("browse")}</Link>
        </Button>
      </div>
    );
  return (
    <div className="flex w-full flex-col items-center gap-3">
      {state.status === "error" ? (
        <Callout tone="danger" live title={state.message} className="w-full text-start" />
      ) : null}
      <Button size="lg" loading={state.status === "busy"} onClick={() => void claim()}>
        {t("claim")}
      </Button>
    </div>
  );
}
