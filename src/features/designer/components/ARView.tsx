"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/i18n/format";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { Skeleton } from "@/ui/components/Skeleton";

import { boxModel, type BoxModelInput } from "../lib/ar-model";

type Model = { glb: string; usdz: string | null; sizeMm: [number, number, number] };

/**
 * The box at its real size in the customer's room (U4.7): the closed box as glTF and USDZ, shown by
 * `model-viewer` — AR through WebXR or Scene Viewer on Android and Quick Look on iPhone — and, where
 * the device has no AR (a desktop), the 3D model with its size and the files to open on a phone.
 */
export default function ARView({ input, name, onClose }: { input: BoxModelInput; name: string; onClose: () => void }) {
  const t = useTranslations("designer.ar");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "th" | "en";
  const [model, setModel] = useState<Model | "failed" | null>(null);
  const [canAr, setCanAr] = useState<boolean | null>(null);
  const viewer = useRef<HTMLElement & { canActivateAR?: boolean; activateAR?: () => Promise<void> }>(null);

  useEffect(() => {
    let urls: string[] = [];
    let live = true;
    void (async () => {
      try {
        const [built] = await Promise.all([boxModel(input), import("@google/model-viewer")]);
        if (!live) return;
        const glb = URL.createObjectURL(built.glb);
        const usdz = built.usdz ? URL.createObjectURL(built.usdz) : null;
        urls = [glb, ...(usdz ? [usdz] : [])];
        setModel({ glb, usdz, sizeMm: built.sizeMm });
      } catch {
        if (live) setModel("failed");
      }
    })();
    return () => {
      live = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
    // One model per opening: the dialog is opened again for a changed design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = viewer.current;
    if (!el || typeof model !== "object" || !model) return;
    const ready = () => setCanAr(!!el.canActivateAR);
    el.addEventListener("load", ready);
    return () => el.removeEventListener("load", ready);
  }, [model]);

  const file = (name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "box").slice(0, 60);
  const size = typeof model === "object" && model ? model.sizeMm.map((n) => formatNumber(n, locale)).join(" × ") : "";

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={t("title")}
      description={t("body")}
      closeLabel={tCommon("actions.close")}
      size="lg"
    >
      {model === null ? <Skeleton className="h-80 w-full" /> : null}
      {model === "failed" ? <Callout tone="danger" title={t("failed")} /> : null}
      {typeof model === "object" && model ? (
        <div className="space-y-3">
          <model-viewer
            ref={viewer}
            src={model.glb}
            {...(model.usdz ? { "ios-src": model.usdz } : {})}
            alt={t("alt", { name, size })}
            ar
            ar-modes="webxr scene-viewer quick-look"
            ar-scale="fixed"
            ar-placement="floor"
            camera-controls
            touch-action="pan-y"
            shadow-intensity="0.8"
            style={{
              width: "100%",
              height: "22rem",
              background: "var(--color-surface-subtle)",
              borderRadius: "0.5rem",
            }}
          />
          <p className="text-sm">{t("size", { size })}</p>
          {canAr ? (
            <Button iconStart="box" onClick={() => void viewer.current?.activateAR?.()}>
              {t("open")}
            </Button>
          ) : (
            <Callout tone="info" title={t("noAr")}>
              <p className="mb-2 text-sm">{t("noArBody")}</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="secondary" iconStart="download">
                  <a href={model.glb} download={`${file}.glb`}>
                    {t("glb")}
                  </a>
                </Button>
                {model.usdz ? (
                  <Button asChild size="sm" variant="secondary" iconStart="download">
                    <a href={model.usdz} download={`${file}.usdz`}>
                      {t("usdz")}
                    </a>
                  </Button>
                ) : null}
              </div>
            </Callout>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}
