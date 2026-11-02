"use client";

import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

import { usePushSubscription } from "@/lib/push/usePushSubscription";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { toast } from "@/ui/components/Toast";

import { IosInstallGuide, isIos, isStandalone } from "../pwa/IosInstallGuide";

const noop = () => () => undefined;

/**
 * Push on this device (D-467): turn it on from a tap (never on load — `usePushSubscription`), or off again. On an
 * iPhone, push needs the app on the home screen first (iOS 16.4+), so there the way is the "Add to Home Screen"
 * guide. A browser that refused, or a deployment without a push key, says so plainly.
 */
export function PushOnThisDevice() {
  const t = useTranslations("agentZone.notifications.push");
  const { state, busy, enable, disable } = usePushSubscription("agent");
  const [guide, setGuide] = useState(false);
  const iosBrowser = useSyncExternalStore(noop, () => isIos() && !isStandalone(), () => false);

  let body: React.ReactNode;
  if (iosBrowser) {
    body = (
      <Callout tone="info" title={t("iosTitle")}>
        <p>{t("iosBody")}</p>
        <Button variant="secondary" size="sm" className="mt-3" iconStart="smartphone" onClick={() => setGuide(true)}>
          {t("iosAction")}
        </Button>
      </Callout>
    );
  } else if (state === "granted") {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">{t("on")}</p>
        <Button
          variant="secondary"
          size="sm"
          loading={busy}
          onClick={async () => {
            if (await disable()) toast.success(t("turnedOff"));
          }}
        >
          {t("turnOff")}
        </Button>
      </div>
    );
  } else if (state === "askable") {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">{t("off")}</p>
        <Button
          size="sm"
          iconStart="bell"
          loading={busy}
          onClick={async () => {
            if (await enable(true)) toast.success(t("turnedOn"));
          }}
        >
          {t("turnOn")}
        </Button>
      </div>
    );
  } else {
    body = <p className="text-muted text-sm">{t(state === "denied" ? "denied" : "unavailable")}</p>;
  }

  return (
    <section aria-labelledby="push-device" className="border-border bg-surface rounded-card border p-4 sm:p-5">
      <h2 id="push-device" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <p className="text-muted mt-0.5 mb-3 text-sm">{t("intro")}</p>
      {body}
      <IosInstallGuide open={guide} onOpenChange={setGuide} />
    </section>
  );
}
