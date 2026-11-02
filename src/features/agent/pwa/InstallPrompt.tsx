"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";

import { IosInstallGuide, isIos, isStandalone } from "./IosInstallGuide";
import { countVisit, DISMISSED_KEY, shouldOffer } from "./install-visits";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * "Install getpack Agent" (D-467): our own card, from the second visit, dismissible for good. Where the browser can
 * install (Chrome, Edge, Samsung Internet) it holds the browser's prompt and shows it on "ติดตั้ง"; on an iPhone it
 * opens the Add to Home Screen guide instead. It floats above the phone's tab bar and in the corner on a desktop,
 * covering nothing it cannot be moved off with one tap.
 */
export function InstallPrompt() {
  const t = useTranslations("agentZone.install");
  const tCommon = useTranslations("common");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    let visits = 0;
    let dismissed = false;
    try {
      visits = countVisit(window.localStorage, window.sessionStorage);
      dismissed = window.localStorage.getItem(DISMISSED_KEY) !== null;
    } catch {
      return; // no storage, no prompt: it could not be dismissed for good
    }
    const offer = shouldOffer({ visits, dismissed, installed: isStandalone() });
    if (!offer) return;
    if (isIos()) {
      // After paint: the card is a late, optional offer, never part of the first render.
      const timer = window.setTimeout(() => {
        setIos(true);
        setVisible(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
    } catch {
      // not remembered — it comes back next visit
    }
  };

  const install = async () => {
    if (ios) {
      setGuide(true);
      return;
    }
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setVisible(false);
  };

  return (
    <>
      {visible ? (
        <section
          aria-labelledby="install-title"
          className="border-border bg-surface-raised shadow-overlay rounded-card z-sticky fixed inset-x-3 bottom-[calc(var(--mobile-tab-h)+0.75rem)] flex items-start gap-3 border p-4 sm:inset-x-auto sm:end-6 sm:bottom-6 sm:w-96 print:hidden"
        >
          <Image src="/agent-app/icon-192.png" alt="" width={44} height={44} className="rounded-control shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 id="install-title" className="font-semibold">
              {t("title")}
            </h2>
            <p className="text-muted mt-0.5 text-sm">{ios ? t("bodyIos") : t("body")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void install()}>
                {ios ? t("howTo") : t("install")}
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                {t("notNow")}
              </Button>
            </div>
          </div>
          <IconButton name="close" label={tCommon("actions.close")} size="sm" onClick={dismiss} className="-me-1 -mt-1" />
        </section>
      ) : null}
      <IosInstallGuide open={guide} onOpenChange={setGuide} />
    </>
  );
}
