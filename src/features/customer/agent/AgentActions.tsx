"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

/** Withdraws my open application (`store.agent.withdrawApplication`). */
export function WithdrawApplication() {
  const t = useTranslations("agent.application");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await browserApi().POST("/v1/store/agent/application/actions/withdraw");
          router.refresh();
        } catch (error) {
          toast.error(isApiError(error) ? error.detail : t("failed"));
          setBusy(false);
        }
      }}
    >
      {t("withdraw")}
    </Button>
  );
}
