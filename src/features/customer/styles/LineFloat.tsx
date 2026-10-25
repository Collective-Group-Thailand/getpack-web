"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

import { useCompare } from "./compare-store";

/**
 * "คุยทาง LINE" at the page's bottom-end corner (styles redesign §6.1): the LINE Official Account
 * getpack configured (`store.support.channels.lineOaId` — never a constant here), with its id to
 * copy, the add-friend link, and the call-back request of the existing CS hand-off. A chat icon
 * and words, not LINE's logo. It moves up when the compare tray is docked, so neither hides the
 * other. The page renders it only when an id is configured.
 *
 * A disclosure rather than a popover library: it is on the page from the first paint, so it
 * carries no script beyond its own (the storefront's JS budget). Escape and a click outside
 * close it; Escape returns focus to the button.
 */
export function LineFloat({ lineOaId }: { lineOaId: string }) {
  const t = useTranslations("styles.library");
  const tray = useCompare().codes.length > 0;
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  // LINE's add-friend link takes the id with its "@", percent-encoded.
  const addFriend = `https://line.me/R/ti/p/${encodeURIComponent(lineOaId)}`;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      root.current?.querySelector<HTMLButtonElement>("[data-line-toggle]")?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className={cn(
        "z-sticky fixed end-4 flex flex-col items-end gap-2 transition-[bottom] duration-200 motion-reduce:transition-none",
        tray ? "bottom-40 md:bottom-24" : "bottom-20 md:bottom-6",
      )}
    >
      {open ? (
        <section
          id={id}
          aria-labelledby={`${id}-title`}
          className="border-border bg-surface-raised shadow-overlay rounded-card flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 border p-4"
        >
          <div>
            <h2 id={`${id}-title`} className="font-semibold">
              {t("lineTitle")}
            </h2>
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
        </section>
      ) : null}
      <Button
        data-line-toggle=""
        iconStart="chat"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="shadow-overlay max-md:px-3"
      >
        <span className="max-md:sr-only">{t("lineOpen")}</span>
      </Button>
    </div>
  );
}
