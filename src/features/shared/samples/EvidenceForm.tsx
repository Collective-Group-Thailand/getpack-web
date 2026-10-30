"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { uploadFile } from "@/features/shared/files/upload";
import type { Zone } from "@/lib/zones";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input } from "@/ui/components/Input";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";

const MM = /^\d{1,4}(\.\d)?$/;
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * A sample's evidence before it ships (U2.F3, D-255): the measured size on its basis, the material
 * actually used and at least one photo — the recorder's own uploads. Once, then fixed. CS (admin)
 * and the factory (partner, Owner / Planner / QC) record it the same way.
 */
export function EvidenceForm({
  zone,
  factoryId,
  flat = false,
  onSubmit,
}: {
  zone: Extract<Zone, "admin" | "partner">;
  factoryId?: string;
  /** A flat item has no depth. */
  flat?: boolean;
  onSubmit: (body: Schemas["SampleEvidenceDto"]) => Promise<void>;
}) {
  const t = useTranslations("common.sampleEvidence");
  const [size, setSize] = useState({ l: "", w: "", d: "" });
  const [basis, setBasis] = useState<Schemas["MeasurementBasis"]>("internal");
  const [material, setMaterial] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const ready = MM.test(size.l) && MM.test(size.w) && (flat || MM.test(size.d)) && material.trim() && files.length > 0;

  const submit = async () => {
    setBusy(true);
    try {
      const uploaded = await Promise.all(
        files.map((file) => uploadFile(zone, file, "evidence", factoryId ? { factoryId } : {})),
      );
      await onSubmit({
        basis,
        lengthMm: Number(size.l),
        widthMm: Number(size.w),
        ...(flat ? {} : { depthMm: Number(size.d) }),
        materialUsed: material.trim(),
        photoFileIds: uploaded.map((file) => file.id),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Field label={t("basis")}>
        <SearchableSelect
          value={basis}
          onValueChange={setBasis}
          options={(["internal", "external", "over_crease"] as const).map((value) => ({
            value,
            label: t(`bases.${value}`),
          }))}
        />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        {(["l", "w", "d"] as const).map((k) =>
          k === "d" && flat ? null : (
            <Field key={k} label={t(`sizes.${k}`)}>
              <Input
                inputMode="decimal"
                value={size[k]}
                onChange={(event) => setSize((s) => ({ ...s, [k]: event.target.value.trim() }))}
              />
            </Field>
          ),
        )}
      </div>
      <Field label={t("material")} hint={t("materialHint")}>
        <Input value={material} maxLength={200} onChange={(event) => setMaterial(event.target.value)} />
      </Field>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("photos")}</span>
        <FileDropzone
          accept="image/*"
          multiple
          maxBytes={MAX_BYTES}
          onFiles={(chosen) => setFiles((list) => [...list, ...chosen].slice(0, 10))}
          labels={{
            prompt: files.length ? t("chosen", { names: files.map((f) => f.name).join(", ") }) : t("drop"),
            browse: t("browse"),
            hint: t("photosHint"),
            tooLarge: (name) => t("tooLarge", { name }),
            wrongType: (name) => t("wrongType", { name }),
          }}
        />
      </div>
      <div>
        <Button loading={busy} disabled={!ready} onClick={() => void submit()}>
          {t("submit")}
        </Button>
      </div>
      <p className="text-muted text-xs">{t("once")}</p>
    </div>
  );
}
