"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

import { newImage } from "../../lib/create";
import { useEditor } from "../../store/editor";
import type { ImageElement } from "../../types";
import { useDesigner } from "../DesignerContext";

/**
 * Upload an image, or place one already in this design again. In an account design an upload is
 * stored once as a design asset (F4 C.1) and the document refers to it.
 */
export function UploadsPanel() {
  const t = useTranslations("designer.uploads");
  const addElement = useEditor((s) => s.addElement);
  const elements = useEditor((s) => s.content.elements);
  const { center } = useDesigner();
  const fileRef = useRef<HTMLInputElement>(null);
  const images = [
    ...new Map(elements.filter((e): e is ImageElement => e.type === "image").map((e) => [e.src, e])).values(),
  ];

  const onFiles = async (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      try {
        addElement(await newImage(center(), file));
      } catch (error) {
        toast.error(error instanceof Error && error.message === "too_large" ? t("tooLarge") : t("unreadable"));
      }
    }
  };

  return (
    <div className="space-y-4">
      <Button size="sm" iconStart="upload" className="w-full" onClick={() => fileRef.current?.click()}>
        {t("upload")}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        multiple
        hidden
        onChange={(event) => {
          void onFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <p className="text-muted text-xs">{t("hint")}</p>
      {images.length ? (
        <ul className="grid grid-cols-3 gap-2">
          {images.map((image) => (
            <li key={image.id}>
              <button
                type="button"
                aria-label={t("placeAgain")}
                onClick={() => {
                  const c = center();
                  const { id: _id, ...rest } = image;
                  void _id;
                  addElement({
                    ...rest,
                    x: c.x - image.width / 2,
                    y: c.y - image.height / 2,
                    locked: false,
                    groupId: undefined,
                  });
                }}
                className="border-border hover:bg-surface-subtle focus-visible:ring-focus-ring block aspect-square w-full overflow-hidden rounded-md border outline-none focus-visible:ring-2"
              >
                {/* A data URL or a signed asset URL: next/image cannot optimise either. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.src} alt="" className="h-full w-full object-contain" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
