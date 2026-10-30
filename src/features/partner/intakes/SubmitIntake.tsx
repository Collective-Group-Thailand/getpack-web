"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { problemMessage } from "@/features/shared/actions";
import { uploadFile } from "@/features/shared/files/upload";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

const BASE_CODE = /^PK-[A-Z]{2}-\d{2,3}$/;

/**
 * Offering a dieline to getpack's library (U3.6, D-272): the DXF or PDF, a title, the library style
 * it is closest to (if the factory knows), a note — under the intake terms in force, which the
 * factory reads and accepts here; the version accepted goes with the offer (provenance).
 */
export function SubmitIntake({ terms }: { terms: Schemas["IntakeTermsDto"] }) {
  const t = useTranslations("partnerJobs.intakes.submit");
  const locale = useLocale();
  const router = useRouter();
  const { factoryId, can } = useFactory();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [baseCode, setBaseCode] = useState("");
  const [note, setNote] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!can("factory_style_intakes.submit")) return <p className="text-muted text-sm">{t("readOnly")}</p>;
  const ready = !!file && !!title.trim() && accepted && (!baseCode || BASE_CODE.test(baseCode));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!ready || !file) return;
        setBusy(true);
        try {
          const uploaded = await uploadFile("partner", file, "dieline", { factoryId });
          await browserApi().POST("/v1/partner/factories/{factoryId}/style-intakes", {
            params: { path: { factoryId } },
            body: {
              fileId: uploaded.id,
              title: title.trim(),
              acceptedTermsVersion: terms.version,
              ...(baseCode ? { baseCode } : {}),
              ...(note.trim() ? { note: note.trim() } : {}),
            },
          });
          toast.success(t("sent"));
          setFile(null);
          setTitle("");
          setBaseCode("");
          setNote("");
          setAccepted(false);
          router.refresh();
        } catch (error) {
          toast.error(problemMessage(error, t("failed")));
        } finally {
          setBusy(false);
        }
      }}
    >
      <FileDropzone
        accept=".dxf,.pdf,application/pdf,application/dxf"
        maxBytes={50 * 1024 * 1024}
        onFiles={(files) => setFile(files[0] ?? null)}
        labels={{
          prompt: file ? t("chosen", { name: file.name }) : t("drop"),
          browse: t("browse"),
          hint: t("hint"),
          tooLarge: (name) => t("tooLarge", { name }),
          wrongType: (name) => t("wrongType", { name }),
        }}
      />
      <Field label={t("title")} required>
        <Input
          placeholder={t("titlePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="min-h-11 md:min-h-10"
        />
      </Field>
      <Field label={t("baseCode")} hint={t("baseCodeHint")}>
        <Input
          placeholder={t("baseCodePlaceholder")}
          value={baseCode}
          onChange={(e) => setBaseCode(e.target.value.toUpperCase())}
          className="min-h-11 md:min-h-10"
        />
      </Field>
      <Field label={t("note")}>
        <Textarea
          placeholder={t("notePlaceholder")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={2000}
        />
      </Field>
      <section
        aria-labelledby="intake-terms"
        tabIndex={0}
        className="border-border bg-bg-subtle focus-visible:ring-focus-ring max-h-60 overflow-y-auto rounded-lg border p-3 outline-none focus-visible:ring-2"
      >
        <h3 id="intake-terms" className="mb-1 text-sm font-semibold">
          {t("termsTitle", { version: terms.version })}
        </h3>
        <p className="text-sm whitespace-pre-line">{locale === "en" ? terms.textEn : terms.textTh}</p>
      </section>
      <Checkbox label={t("accept")} checked={accepted} onCheckedChange={(on) => setAccepted(on === true)} />
      <div>
        <Button type="submit" className="min-h-11 md:min-h-10" loading={busy} disabled={!ready}>
          {t("send")}
        </Button>
      </div>
    </form>
  );
}
