"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";

import { trackingTokenOf } from "./state";

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type DetectorClass = new (options: { formats: string[] }) => Detector;

/** The browser's own QR reader (Chrome on Android) and a camera — the only way this page scans. */
export function scannerAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return "BarcodeDetector" in window && typeof navigator.mediaDevices?.getUserMedia === "function";
}

/** How long one carton's QR stays in view before the next read counts as another carton. */
const SETTLE_MS = 1500;

/**
 * Optional carton check for the driver (D-462): the camera reads each carton's QR — the public tracking URL — and
 * counts it. Every carton of a trip carries the same tracking token, so the count is of reads, not distinct tokens;
 * the API checks the tokens belong to the trip when the pickup is confirmed. Another QR is named and not counted.
 * Rendered only where `scannerAvailable()`; elsewhere the driver confirms without scanning.
 */
export function CartonScanner({
  open,
  onOpenChange,
  count,
  total,
  onScan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  total: number;
  onScan: (token: string) => void;
}) {
  const t = useTranslations("fulfilment.handover.scan");
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<"starting" | "on" | "unavailable">("starting");
  const [foreign, setForeign] = useState(false);
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    let quietUntil = 0;
    const start = async () => {
      const Detector = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
      if (!Detector || !navigator.mediaDevices?.getUserMedia) return setCamera("unavailable");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        setCamera("on");
        const detector = new Detector({ formats: ["qr_code"] });
        timer = setInterval(async () => {
          if (!video.current || Date.now() < quietUntil) return;
          const found = await detector.detect(video.current).catch(() => []);
          const raw = found[0]?.rawValue;
          if (!raw) return;
          quietUntil = Date.now() + SETTLE_MS;
          const token = trackingTokenOf(raw);
          setForeign(!token);
          if (token) {
            onScan(token);
            setFlash((n) => n + 1);
            navigator.vibrate?.(60);
          }
        }, 300);
      } catch {
        setCamera("unavailable");
      }
    };
    void start();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open, onScan]);

  const counted = t("counted", { count, total });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setCamera("starting");
        setForeign(false);
        onOpenChange(next);
      }}
      title={t("title")}
      closeLabel={t("close")}
      footer={
        <Button size="lg" block onClick={() => onOpenChange(false)}>
          {t("done")}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {camera === "unavailable" ? (
          <p className="text-muted text-sm [overflow-wrap:break-word] break-keep">{t("unavailable")}</p>
        ) : (
          <>
            <video
              ref={video}
              muted
              playsInline
              aria-hidden="true"
              className="bg-surface-subtle aspect-square w-full rounded-lg object-cover"
            />
            <p className="text-muted text-sm [overflow-wrap:break-word] break-keep">{t("aim")}</p>
          </>
        )}
        <p
          key={flash}
          role="status"
          aria-live="polite"
          className="bg-primary-subtle text-primary-subtle-fg rounded-control px-3 py-2 text-center text-lg font-semibold tabular-nums"
        >
          {counted}
        </p>
        {foreign ? (
          <p role="alert" className="text-danger text-sm">
            {t("foreign")}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
