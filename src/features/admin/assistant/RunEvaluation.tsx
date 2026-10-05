"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { newIdempotencyKey } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage, useCan } from "../console";

/** Runs the evaluation suite now (`admin.assistant.runEval`, `assistant.manage`), then shows the result. */
export function RunEvaluation() {
  const t = useTranslations("analytics.assistant");
  const router = useRouter();
  const allowed = useCan("assistant.manage");
  const [busy, setBusy] = useState(false);
  if (!allowed) return null;
  return (
    <Button
      variant="secondary"
      iconStart="play"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { data } = await adminBrowserApis().contract.POST("/v1/admin/assistant/eval-runs", {
            params: { header: { "Idempotency-Key": newIdempotencyKey() } },
          });
          toast.success(t("ran", { passed: data!.passed, cases: data!.cases }));
          router.push(`/assistant/runs/${data!.id}`);
        } catch (error) {
          toast.error(problemMessage(error, t("runFailed")));
        } finally {
          setBusy(false);
        }
      }}
    >
      {t("runNow")}
    </Button>
  );
}
