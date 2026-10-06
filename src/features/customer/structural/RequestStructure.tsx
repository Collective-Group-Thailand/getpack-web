"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { problemMessage } from "@/features/shared/actions";
import { uploadFile } from "@/features/shared/files/upload";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

const SIZE = /^\d{1,4}(\.\d)?$/;

/**
 * "ไม่เจอแบบที่ต้องการ" (U3.6, D-273): a customer describes the structure the library lacks — the
 * product type, what goes in it and how it is used, its sizes on a stated basis, the quantity, and
 * photos or drawings — and Packio's structural designers take it from there. A fee, when one
 * applies, is quoted separately before any work is charged.
 */
export function RequestStructure({ productTypes }: { productTypes: { value: string; label: string }[] }) {
  const t = useTranslations("styles.request");
  const router = useRouter();
  const [type, setType] = useState(productTypes[0]?.value ?? "");
  const [description, setDescription] = useState("");
  const [basis, setBasis] = useState<Schemas["MeasurementBasis"]>("internal");
  const [l, setL] = useState("");
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [quantity, setQuantity] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const sizesOk = [l, w, h].every((x) => !x || SIZE.test(x));
  const ready = !!type && description.trim().length >= 20 && sizesOk && (!quantity || /^\d{1,7}$/.test(quantity));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!ready) return;
        setBusy(true);
        try {
          const uploaded = await Promise.all(files.map((f) => uploadFile("customer", f, "document")));
          const { data } = await browserApi().POST("/v1/store/structural-requests", {
            body: {
              productTypeCode: type,
              description: description.trim(),
              measurementBasis: basis,
              ...(l ? { lengthMm: Number(l) } : {}),
              ...(w ? { widthMm: Number(w) } : {}),
              ...(h ? { heightMm: Number(h) } : {}),
              ...(quantity ? { quantity: Number(quantity) } : {}),
              ...(uploaded.length ? { fileIds: uploaded.map((u) => u.id) } : {}),
            },
          });
          toast.success(t("sent"));
          router.push(`/account/structural-requests/${data!.id}`);
        } catch (error) {
          toast.error(problemMessage(error, t("failed")));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label={t("productType")} required>
        <Select value={type} onValueChange={setType} options={productTypes} />
      </Field>
      <Field label={t("description")} hint={t("descriptionHint")} required>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={4000} />
      </Field>
      <SegmentedControl
        label={t("basis")}
        value={basis}
        onValueChange={(v) => setBasis(v as Schemas["MeasurementBasis"])}
        options={[
          { value: "internal", label: t("bases.internal") },
          { value: "external", label: t("bases.external") },
        ]}
      />
      <div className="grid grid-cols-3 gap-3">
        <Field label={t("length")}>
          <Input inputMode="decimal" value={l} onChange={(e) => setL(e.target.value)} />
        </Field>
        <Field label={t("width")}>
          <Input inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} />
        </Field>
        <Field label={t("height")}>
          <Input inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} />
        </Field>
      </div>
      {!sizesOk ? <p className="text-danger text-sm">{t("sizesInvalid")}</p> : null}
      <Field label={t("quantity")}>
        <Input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </Field>
      <FileDropzone
        accept="image/*,application/pdf,.dxf,.ai"
        maxBytes={20 * 1024 * 1024}
        multiple
        onFiles={(next) => setFiles(next.slice(0, 5))}
        labels={{
          prompt: files.length ? t("chosen", { names: files.map((f) => f.name).join(", ") }) : t("drop"),
          browse: t("browse"),
          hint: t("filesHint"),
          tooLarge: (name) => t("tooLarge", { name }),
          wrongType: (name) => t("wrongType", { name }),
        }}
      />
      <p className="text-muted text-sm">{t("feeNote")}</p>
      <div>
        <Button type="submit" loading={busy} disabled={!ready}>
          {t("send")}
        </Button>
      </div>
    </form>
  );
}
