"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

/**
 * The deal's share link (an agent's carries `?ref=`): shown in full so it can be checked, copied with one press, or
 * handed to the phone's share sheet where there is one.
 */
export function ShareLink({ url, title }: { url: string; title: string }) {
  const t = useTranslations("deals.detail");
  return (
    <div className="flex flex-col gap-2">
      <p className="border-border bg-surface-subtle rounded-control text-muted m-0 truncate border px-3 py-2.5 text-[0.8125rem] tabular-nums">
        {url}
      </p>
      <Button
        variant="secondary"
        iconStart="link"
        onClick={async () => {
          if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
            await navigator.share({ title, url }).catch(() => undefined);
            return;
          }
          await navigator.clipboard?.writeText(url).catch(() => undefined);
          toast.success(t("linkCopied"));
        }}
      >
        {t("copyLink")}
      </Button>
    </div>
  );
}
