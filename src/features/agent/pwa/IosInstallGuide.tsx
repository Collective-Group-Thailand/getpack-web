"use client";

import { useTranslations } from "next-intl";

import { Sheet } from "@/ui/components/Sheet";
import { Icon } from "@/ui/icons";

/** iPhone or iPad Safari (an iPad says "Macintosh" but has a touch screen). */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** Running as the installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * "Add to Home Screen" on an iPhone (D-467): Safari has no install prompt, and web push on iOS works only in the
 * installed app — so the three taps, in Safari's own words, as a bottom sheet.
 */
export function IosInstallGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("agentZone.install.ios");
  const tCommon = useTranslations("common");
  const steps = [
    { icon: "share" as const, text: t("step1") },
    { icon: "plus" as const, text: t("step2") },
    { icon: "check" as const, text: t("step3") },
  ];
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side="bottom"
      title={t("title")}
      description={t("body")}
      closeLabel={tCommon("actions.close")}
    >
      <ol className="flex flex-col gap-4 pb-[env(safe-area-inset-bottom)]">
        {steps.map((step, index) => (
          <li key={index} className="flex items-start gap-3">
            <span className="bg-primary-subtle text-primary-subtle-fg grid size-10 shrink-0 place-items-center rounded-full">
              <Icon name={step.icon} size={20} aria-hidden="true" />
            </span>
            <span className="pt-2">
              <span className="sr-only">{t("stepLabel", { n: index + 1 })} </span>
              {step.text}
            </span>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}
