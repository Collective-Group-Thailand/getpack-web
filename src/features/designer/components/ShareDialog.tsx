"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";

/**
 * A view-only link to the design (`store.designs.share`, D-226): anyone with it sees the current
 * version, nobody can edit it, it expires (`configurations.share_link_days`) and revoking it ends
 * it. Sharing again replaces the previous link. Comments on a shared design are U4.B6.
 */
export function ShareDialog({ designId, open, onClose }: { designId: string; open: boolean; onClose: () => void }) {
  const t = useTranslations("designer.share");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const [state, setState] = useState<{ url: string; expiresAt: string } | "loading" | "error" | "revoked">("loading");
  const asked = useRef(false);

  useEffect(() => {
    // One link per opening: the share call replaces the previous link, so it is not repeated.
    if (asked.current) return;
    asked.current = true;
    browserApi()
      .POST("/v1/store/designs/{designId}/actions/share", { params: { path: { designId } } })
      .then(({ data }) =>
        setState({ url: `${window.location.origin}/design/shared/${data!.shareToken}`, expiresAt: data!.expiresAt }),
      )
      .catch(() => setState("error"));
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
      await browserApi().DELETE("/v1/store/designs/{designId}/share", { params: { path: { designId } } });
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
          <Field label={t("link")} hint={t("expires", { date: format.dateTime(state.expiresAt) })}>
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
