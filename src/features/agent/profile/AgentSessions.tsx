"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

/**
 * "Sign out of getpack Agent on other devices" (D-467, `store.me.revokeSessions` with `client: agent`): this device
 * stays signed in; the storefront's sessions are untouched. Confirmed first — it cannot be undone.
 */
export function SignOutOtherAgentDevices({ others }: { others: number }) {
  const t = useTranslations("agentZone.profile.sessions");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="secondary" iconStart="log-out" disabled={others === 0} onClick={() => setOpen(true)}>
        {t("signOutOthers")}
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => !busy && setOpen(next)}
        title={t("confirmTitle")}
        description={t("confirmBody")}
        cancelLabel={tCommon("actions.cancel")}
        confirmLabel={t("confirm")}
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            const { data } = await browserApi().POST("/v1/store/me/sessions/actions/revoke", {
              body: { client: "agent", includeCurrent: false },
            });
            toast.success(t("done", { count: data?.revoked ?? 0 }));
            setOpen(false);
            router.refresh();
          } catch (error) {
            toast.error(isApiError(error) ? error.detail : t("failed"));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
