"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { problemMessage } from "@/features/shared/actions";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { Button } from "@/ui/components/Button";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { toast } from "@/ui/components/Toast";

/** Withdrawing a request while nobody has delivered a design for it (`store.structuralRequests.cancel`). */
export function CancelRequest({ requestId }: { requestId: string }) {
  const t = useTranslations("styles.request");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="ghost" className="text-danger" onClick={() => setOpen(true)}>
        {t("cancel")}
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={setOpen}
        tone="destructive"
        loading={busy}
        title={t("cancelTitle")}
        description={t("cancelBody")}
        confirmLabel={t("cancel")}
        cancelLabel={t("keep")}
        onConfirm={async () => {
          setBusy(true);
          try {
            await browserApi().POST("/v1/store/structural-requests/{requestId}/actions/cancel", {
              params: { path: { requestId } },
              body: {},
            });
            toast.success(t("cancelled"));
            setOpen(false);
            router.refresh();
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
