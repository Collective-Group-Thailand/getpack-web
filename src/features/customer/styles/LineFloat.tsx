"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Popover } from "@/ui/components/Popover";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

import { useCompare } from "./compare-store";

/**
 * "คุยทาง LINE" at the page's bottom-end corner (styles redesign §6.1): the LINE Official Account
 * getpack configured (`store.support.channels.lineOaId` — never a constant here), with its id to
 * copy, the add-friend link, and the call-back request of the existing CS hand-off. A chat icon
 * and words, not LINE's logo. It moves up when the compare tray is docked, so neither hides the
 * other. The page renders it only when an id is configured.
 */
export function LineFloat({ lineOaId }: { lineOaId: string }) {
  const t = useTranslations("styles.library");
  const tray = useCompare().codes.length > 0;
  // LINE's add-friend link takes the id with its "@", percent-encoded.
  const addFriend = `https://line.me/R/ti/p/${encodeURIComponent(lineOaId)}`;
  return (
    <div
      className={cn(
        "z-sticky fixed end-4 transition-[bottom] duration-200 motion-reduce:transition-none",
        tray ? "bottom-40 md:bottom-24" : "bottom-20 md:bottom-6",
      )}
    >
      <Popover
        side="top"
        align="end"
        aria-label={t("lineTitle")}
        className="w-80"
        trigger={
          <Button iconStart="chat" className="shadow-overlay rounded-full max-md:px-3" aria-label={t("lineOpen")}>
            <span className="max-md:sr-only">{t("lineOpen")}</span>
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <p className="font-semibold">{t("lineTitle")}</p>
            <p className="text-muted mt-0.5 text-sm">{t("lineBody")}</p>
          </div>
          <div className="border-border bg-surface flex items-center justify-between gap-2 rounded-md border px-3 py-2">
            <span className="font-mono text-sm">{lineOaId}</span>
            <Button
              size="sm"
              variant="ghost"
              iconStart="copy"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(lineOaId);
                  toast.success(t("lineCopied"));
                } catch {
                  toast(lineOaId);
                }
              }}
            >
              {t("lineCopy")}
            </Button>
          </div>
          <Button asChild block>
            <a href={addFriend} target="_blank" rel="noopener noreferrer">
              {t("lineAdd")}
            </a>
          </Button>
          <Button asChild block variant="secondary" iconStart="phone">
            <Link href="/help/chat">{t("lineCallback")}</Link>
          </Button>
        </div>
      </Popover>
    </div>
  );
}
