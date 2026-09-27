"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Field } from "./Field";
import { Input } from "./Input";

export interface ScanButtonLabels {
  open: string;
  title: string;
  /** Under the camera: "เล็งกล้องไปที่ QR บนใบงานหรือฉลากกล่อง". */
  aim: string;
  /** Shown when the browser has no camera or no barcode detector: type the code instead. */
  noCamera: string;
  manual: string;
  manualHint: string;
  submit: string;
  close: string;
}

export interface ScanButtonProps {
  onCode: (code: string) => void;
  labels: ScanButtonLabels;
  className?: string;
}

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => Detector;
  }
}

/**
 * Scan a job traveller's or a carton label's code (design-system.md §3 "ScanButton (QR)").
 * The rear camera and the browser's own `BarcodeDetector` read it where they exist (Chrome on
 * Android); everywhere else, and always as well, the code can be typed — the shop floor never
 * depends on a camera working.
 */
export function ScanButton({ onCode, labels, className }: ScanButtonProps) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [camera, setCamera] = useState<"starting" | "on" | "unavailable">("starting");
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    const start = async () => {
      const Detector = typeof window !== "undefined" ? window.BarcodeDetector : undefined;
      if (!Detector || !navigator.mediaDevices?.getUserMedia) return setCamera("unavailable");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        setCamera("on");
        const detector = new Detector({ formats: ["qr_code", "code_128", "ean_13"] });
        timer = setInterval(async () => {
          if (!video.current) return;
          const found = await detector.detect(video.current).catch(() => []);
          const value = found[0]?.rawValue?.trim();
          if (value) {
            setOpen(false);
            onCode(value);
          }
        }, 350);
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
  }, [open, onCode]);

  return (
    <>
      <Button
        size="xl"
        variant="secondary"
        iconStart="scan"
        className={className}
        onClick={() => {
          setCamera("starting");
          setOpen(true);
        }}
      >
        {labels.open}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={labels.title} closeLabel={labels.close}>
        <div className="flex flex-col gap-4">
          {camera === "unavailable" ? (
            <p className="text-muted">{labels.noCamera}</p>
          ) : (
            <>
              <video ref={video} muted playsInline className="bg-neutral aspect-square w-full rounded-lg object-cover" />
              <p className="text-muted text-sm">{labels.aim}</p>
            </>
          )}
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!code.trim()) return;
              setOpen(false);
              onCode(code.trim());
              setCode("");
            }}
          >
            <Field label={labels.manual} hint={labels.manualHint}>
              <Input inputSize="lg" autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} />
            </Field>
            <Button type="submit" size="xl" disabled={!code.trim()}>
              {labels.submit}
            </Button>
          </form>
        </div>
      </Dialog>
    </>
  );
}
