"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { browserRequests } from "@/lib/api/requests/browser";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";

/**
 * A view-only link to the design (`store.design-share`): anyone with it sees the design, nobody
 * can edit it, and revoking it ends it. Comments on a shared design are deferred (PROGRESS).
 */
export function ShareDialog({ designId, open, onClose }: { designId: string; open: boolean; onClose: () => void }) {
  const t = useTranslations("designer.share");
  const tCommon = useTranslations("common");
  const [state, setState] = useState<{ url: string } | "loading" | "error" | "revoked">("loading");
  const key = useRef(crypto.randomUUID());

  useEffect(() => {
    let live = true;
    browserRequests()
      .call("POST /v1/store/designs/{designId}/actions/share", {
        path: { designId },
        body: {},
        idempotencyKey: key.current,
      })
      .then((share) => live && setState({ url: `${window.location.origin}/design/shared/${share.token}` }))
      .catch(() => live && setState("error"));
    return () => {
      live = false;
    };
  }, [designId]);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  const revoke = async () => {
    try {
      await browserRequests().call("DELETE /v1/store/designs/{designId}/share", { path: { designId } });
      setState("revoked");
    } catch {
      toast.error(t("revokeFailed"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t("title")}
      description={t("body")}
      closeLabel={tCommon("actions.close")}
      size="md"
    >
      {state === "loading" ? <Skeleton className="h-10 w-full" /> : null}
      {state === "error" ? <Callout tone="danger" title={t("failed")} /> : null}
      {state === "revoked" ? <Callout tone="info" title={t("revoked")} /> : null}
      {typeof state === "object" ? (
        <div className="space-y-4">
          <Field label={t("link")}>
            <Input readOnly value={state.url} onFocus={(event) => event.target.select()} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button iconStart="copy" onClick={() => void copy(state.url)}>
              {t("copy")}
            </Button>
            <Button variant="ghost" iconStart="ban" onClick={() => void revoke()}>
              {t("revoke")}
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
