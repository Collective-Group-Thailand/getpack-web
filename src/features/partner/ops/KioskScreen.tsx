"use client";

import { useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { Button } from "@/ui/components/Button";

type WakeLock = { release: () => Promise<void> };
const Screen = createContext<{ full: boolean; toggle: () => void } | null>(null);

/** The kiosk's full-screen switch, placed with the page's other actions. */
export function KioskFullScreenButton() {
  const t = useTranslations("partnerOps.kiosk");
  const screen = useContext(Screen);
  if (!screen) return null;
  return (
    <Button variant="secondary" size="xl" iconStart={screen.full ? "minimize" : "maximize"} onClick={screen.toggle}>
      {screen.full ? t("exitFullScreen") : t("fullScreen")}
    </Button>
  );
}

/**
 * A machine's screen on the tablet beside it: one tap fills the screen with the machine (no sidebar, no bar to tap by
 * mistake), and the screen stays awake while the page is open (Screen Wake Lock, where the browser has it).
 */
export function KioskScreen({ children }: { children: React.ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", onChange);
    let lock: WakeLock | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (kind: "screen") => Promise<WakeLock> } };
    const keepAwake = () => {
      if (document.visibilityState === "visible" && nav.wakeLock)
        nav.wakeLock
          .request("screen")
          .then((l) => (lock = l))
          .catch(() => undefined);
    };
    keepAwake();
    document.addEventListener("visibilitychange", keepAwake);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("visibilitychange", keepAwake);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void frame.current?.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <Screen.Provider value={{ full, toggle }}>
      <div ref={frame} className={full ? "bg-bg h-full overflow-y-auto p-4 text-lg md:p-8" : undefined}>
        {children}
      </div>
    </Screen.Provider>
  );
}
