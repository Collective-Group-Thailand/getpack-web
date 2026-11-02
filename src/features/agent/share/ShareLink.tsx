"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";
import { QRCode } from "@/ui/components/QRCode";
import { Sheet } from "@/ui/components/Sheet";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

import { lineShareUrl } from "./line";

/**
 * Sharing the agent's link (D-467): the device's own share sheet where there is one (Web Share API — a phone, Safari,
 * Edge); where there is not, or it fails, our own sheet with the same three ways — copy the link, send it on LINE,
 * show the QR full-screen for a customer across the table. Copy and the QR are also one tap away on their own.
 */
export function ShareLink({ link, code, message }: { link: string; code: string; message: string }) {
  const t = useTranslations("agentZone.share");
  const tCommon = useTranslations("common");
  const [sheet, setSheet] = useState(false);
  const [qr, setQr] = useState(false);
  const text = `${message} ${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: t("shareTitle"), text: message, url: link });
        return;
      } catch (error) {
        // The person closed the sheet: nothing to do. Anything else falls back to ours.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    setSheet(true);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button iconStart="share" onClick={() => void share()}>
          {t("share")}
        </Button>
        <Button variant="secondary" iconStart="copy" onClick={() => void copy()}>
          {t("copy")}
        </Button>
        <Button variant="secondary" iconStart="qr-code" onClick={() => setQr(true)}>
          {t("showQr")}
        </Button>
      </div>

      <Sheet
        open={sheet}
        onOpenChange={setSheet}
        side="bottom"
        title={t("sheetTitle")}
        description={t("sheetBody")}
        closeLabel={tCommon("actions.close")}
        className="sm:inset-x-auto sm:start-1/2 sm:bottom-6 sm:w-[28rem] sm:-translate-x-1/2 sm:rounded-card sm:border"
      >
        <ul className="flex flex-col gap-1 pb-[env(safe-area-inset-bottom)]">
          <li>
            <button
              type="button"
              onClick={() => {
                setSheet(false);
                void copy();
              }}
              className="hover:bg-bg focus-visible:ring-focus-ring flex min-h-14 w-full items-center gap-3 rounded-lg px-3 text-start outline-none focus-visible:ring-2"
            >
              <Icon name="copy" size={20} className="text-muted" aria-hidden="true" />
              <span className="flex flex-col">
                <span className="font-medium">{t("copy")}</span>
                <span className="text-muted text-sm break-all">{link}</span>
              </span>
            </button>
          </li>
          <li>
            <a
              href={lineShareUrl(text)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setSheet(false)}
              className="hover:bg-bg focus-visible:ring-focus-ring flex min-h-14 w-full items-center gap-3 rounded-lg px-3 outline-none focus-visible:ring-2"
            >
              <Icon name="chat" size={20} className="text-muted" aria-hidden="true" />
              <span className="font-medium">{t("line")}</span>
            </a>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                setSheet(false);
                setQr(true);
              }}
              className="hover:bg-bg focus-visible:ring-focus-ring flex min-h-14 w-full items-center gap-3 rounded-lg px-3 text-start outline-none focus-visible:ring-2"
            >
              <Icon name="qr-code" size={20} className="text-muted" aria-hidden="true" />
              <span className="font-medium">{t("showQr")}</span>
            </button>
          </li>
        </ul>
      </Sheet>

      <Dialog
        open={qr}
        onOpenChange={setQr}
        size="full"
        title={t("qrTitle")}
        description={t("qrBody")}
        closeLabel={tCommon("actions.close")}
      >
        <div className="flex min-h-full flex-col items-center justify-center gap-5 py-4 text-center">
          <span className="border-border bg-surface rounded-card border p-4">
            <QRCode value={link} size={320} label={t("qrLabel")} className="size-[min(72vw,52dvh)]" />
          </span>
          <p className="text-3xl font-bold tracking-widest tabular-nums" aria-label={t("codeLabel", { code })}>
            {code}
          </p>
          <p className="text-muted max-w-md text-base break-all">{link}</p>
        </div>
      </Dialog>
    </>
  );
}
