"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { uploadFile } from "@/features/shared/files/upload";
import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { NumberInput, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, FormDialog, FormError, useCan } from "../console";

/**
 * A company-level discount (D-124): the percentage goes through the same approval matrix as an
 * order memo (D-052, D-162) and, once approved, applies to the company's orders — never below the
 * margin floor. Evidence (a competitor's quotation, a volume agreement) is optional.
 */
export function CompanyMemoButton({ companyId, companyName }: { companyId: string; companyName: string }) {
  const t = useTranslations("companies.memo");
  const queryClient = useQueryClient();
  const canRequest = useCan("discount_memos.request");
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState("");
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  if (!canRequest) return null;
  return (
    <>
      <Button size="sm" variant="secondary" iconStart="percent" onClick={() => setOpen(true)}>
        {t("open")}
      </Button>
      {open ? (
        <FormDialog
          title={t("title")}
          description={t("body", { company: companyName })}
          submitLabel={t("submit")}
          onClose={() => setOpen(false)}
          onSubmit={async () => {
            if (!/^\d{1,2}(\.\d{1,2})?$/.test(pct) || Number(pct) <= 0) throw new FormError(t("badPct"));
            if (reason.trim().length < 5) throw new FormError(t("needReason"));
            const evidence = await Promise.all(files.map((file) => uploadFile("admin", file, "evidence")));
            await adminBrowserApis().contract.POST("/v1/admin/companies/{companyId}/discount-memos", {
              params: { path: { companyId } },
              body: {
                requestedPct: Number(pct).toFixed(2),
                reason: reason.trim(),
                ...(evidence.length ? { evidenceFileIds: evidence.map((file) => file.id) } : {}),
              },
            });
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "discount_memo") });
            toast.success(t("done"));
            setOpen(false);
          }}
        >
          <Field label={t("pct")} required>
            <NumberInput unit="%" inputMode="decimal" value={pct} onChange={(event) => setPct(event.target.value)} />
          </Field>
          <Field label={t("reason")} hint={t("reasonHint")} required>
            <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <FileDropzone
            accept="image/*,application/pdf"
            multiple
            maxBytes={20 * 1024 * 1024}
            onFiles={setFiles}
            labels={{
              prompt: files.length ? t("chosen", { count: files.length }) : t("drop"),
              browse: t("browse"),
              tooLarge: (name) => t("tooLarge", { name }),
              wrongType: (name) => t("wrongType", { name }),
            }}
          />
        </FormDialog>
      ) : null}
    </>
  );
}
