"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

import {
  announceDraftsChanged,
  available,
  DRAFTS_CHANGED,
  flushDrafts,
  listDrafts,
  removeDraft,
  sendThroughBff,
  type LeadDraft,
} from "./drafts";

/**
 * "รอส่ง" — leads saved on this device while offline (D-468). They sit above the list with a visible state, are sent
 * the moment the connection returns (the `online` event here; the service worker's background sync where the browser
 * has it), and a refused one stays with the reason until the agent removes it. Nothing renders when the queue is empty.
 */
export function PendingDrafts() {
  const t = useTranslations("agentSales.drafts");
  const tProblems = useTranslations("problems");
  const router = useRouter();
  const [drafts, setDrafts] = useState<LeadDraft[]>([]);
  const online = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("online", onChange);
      window.addEventListener("offline", onChange);
      return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );
  const [sending, setSending] = useState(false);

  const reload = useCallback(async () => {
    if (!available()) return;
    setDrafts(await listDrafts().catch(() => []));
  }, []);

  const flush = useCallback(async () => {
    if (!available() || !navigator.onLine) return;
    setSending(true);
    try {
      const result = await flushDrafts(sendThroughBff);
      if (result.sent > 0) {
        toast.success(t("sent", { count: result.sent }));
        router.refresh();
      }
      if (result.refused > 0) toast.error(t("refusedToast", { count: result.refused }));
    } finally {
      setSending(false);
      await reload();
    }
  }, [reload, router, t]);

  useEffect(() => {
    // Read the queue once the page has painted (and send it if the connection is there).
    const start = window.setTimeout(() => void reload().then(() => (navigator.onLine ? flush() : undefined)), 0);
    const goOnline = () => void flush();
    const changed = () => void reload();
    const fromWorker = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === "lead-drafts-flushed") {
        void reload();
        router.refresh();
      }
    };
    window.addEventListener("online", goOnline);
    window.addEventListener(DRAFTS_CHANGED, changed);
    navigator.serviceWorker?.addEventListener("message", fromWorker);
    return () => {
      window.clearTimeout(start);
      window.removeEventListener("online", goOnline);
      window.removeEventListener(DRAFTS_CHANGED, changed);
      navigator.serviceWorker?.removeEventListener("message", fromWorker);
    };
  }, [flush, reload, router]);

  if (drafts.length === 0) return null;
  const waiting = drafts.filter((draft) => !draft.refused).length;

  return (
    <section
      aria-labelledby="pending-drafts"
      className="border-warning/40 bg-warning-subtle/40 rounded-card flex flex-col gap-3 border p-4"
      data-testid="pending-drafts"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="pending-drafts" className="flex items-center gap-2 text-base font-semibold">
          <Icon name="hourglass" size={18} aria-hidden="true" />
          {t("title", { count: drafts.length })}
        </h2>
        {online && waiting > 0 ? (
          <Button size="sm" variant="secondary" iconStart="refresh" loading={sending} onClick={() => void flush()}>
            {t("sendNow")}
          </Button>
        ) : null}
      </div>
      <p className="text-muted text-sm" role="status">
        {online ? t("onlineHint") : t("offlineHint")}
      </p>
      <ul className="flex flex-col gap-2">
        {drafts.map((draft) => (
          <li
            key={draft.id}
            className="bg-surface border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{draft.body.contactName}</span>
              {draft.refused ? (
                <span className="text-danger-subtle-fg block text-xs">
                  {tProblems.has(draft.refused.code) ? tProblems(draft.refused.code) : draft.refused.detail}
                </span>
              ) : (
                <span className="text-muted block text-xs">
                  {String(draft.body["organisationName"] ?? "") || t("savedOnDevice")}
                </span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <Badge tone={draft.refused ? "danger" : "warning"} icon={draft.refused ? "ban" : "hourglass"}>
                {draft.refused ? t("refused") : t("pending")}
              </Badge>
              <IconButton
                name="trash"
                variant="ghost"
                size="lg"
                className="sm:size-10"
                label={t("remove", { name: draft.body.contactName })}
                onClick={async () => {
                  await removeDraft(draft.id);
                  announceDraftsChanged();
                }}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
