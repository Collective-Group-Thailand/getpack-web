"use client";

import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { uploadFile, type UploadedFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics/track";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field, FormSection } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { IconButton } from "@/ui/components/IconButton";

import { quantityBand } from "../analytics/bands";

const SignInSheet = dynamic(() => import("@/features/customer/auth/SignInSheet").then((module) => module.SignInSheet), {
  ssr: false,
});

type Form = ResponseOf<Requests, "GET /v1/store/rfq-forms/{productTypeCode}">;
type SpecValue = string | number | boolean | string[];

export interface RfqFormProps {
  form: Form;
  signedIn: boolean;
  /** The catalogue product the customer came from, when the configurator sent them (D-043). */
  fromProduct: { slug: string; name: string } | null;
}

interface Attached {
  key: string;
  name: string;
  file?: UploadedFile;
  failed?: boolean;
}

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * A request for quotation (F3 3.2, D-100): the category's own questions (rendered by the API from
 * its `rfqSpecSchema`), outside dimensions, up to the category's number of quantities, a target
 * date, where it goes, files and notes.
 *
 * Long forms keep what was typed (design-system.md §4): a failure never clears it, and a guest
 * who is asked to sign in at the end submits the same answers straight after. The submit carries
 * one idempotency key per attempt, so a double tap files one request.
 */
export function RfqForm({ form, signedIn, fromProduct }: RfqFormProps) {
  const t = useTranslations("quoteRequests.form");
  const locale = useLocale();
  const format = useFormat();
  const router = useRouter();
  const [spec, setSpec] = useState<Record<string, SpecValue>>({});
  const [dims, setDims] = useState({ l: "", w: "", h: "" });
  const [quantities, setQuantities] = useState<string[]>([String(Math.max(form.quantity.min, 1000))]);
  const [targetDate, setTargetDate] = useState("");
  const [postcode, setPostcode] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<Attached[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState(signedIn);
  const [signIn, setSignIn] = useState(false);
  const idempotencyKey = useRef(newKey());
  const summaryRef = useRef<HTMLDivElement>(null);

  const label = (field: Form["fields"][number]) => pick(locale, field.labelTh, field.labelEn);
  const uploading = files.some((file) => !file.file && !file.failed);

  function validate(): Record<string, string> {
    const found: Record<string, string> = {};
    for (const field of form.fields) {
      const value = spec[field.key];
      const empty = value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
      if (field.required && empty && field.type !== "boolean")
        found[`spec.${field.key}`] = t("required", { name: label(field) });
      if (field.type === "number" && !empty) {
        const number = Number(value);
        if (field.min !== null && number < field.min)
          found[`spec.${field.key}`] = t("min", { name: label(field), min: field.min });
        if (field.max !== null && number > field.max)
          found[`spec.${field.key}`] = t("max", { name: label(field), max: field.max });
      }
    }
    if (form.dimensions.asked) {
      const axes = form.dimensions.height ? (["l", "w", "h"] as const) : (["l", "w"] as const);
      const any = axes.some((axis) => dims[axis] !== "");
      for (const axis of axes) {
        if ((form.dimensions.required || any) && !/^\d+$/.test(dims[axis]))
          found[`dims.${axis}`] = t("dimensionRequired");
      }
    }
    const numbers = quantities.filter((value) => value.trim() !== "");
    if (numbers.length === 0) found.quantities = t("quantityRequired");
    numbers.forEach((value, index) => {
      if (!/^\d+$/.test(value) || Number(value) < form.quantity.min)
        found[`quantities.${index}`] = t("quantityMin", { min: format.number(form.quantity.min) });
    });
    if (!/^\d{5}$/.test(postcode)) found.postcode = t("postcodeInvalid");
    if (uploading) found.files = t("stillUploading");
    return found;
  }

  async function submit() {
    setSubmitting(true);
    setFailure(null);
    try {
      const rfq = await browserRequests().call("POST /v1/store/rfqs", {
        idempotencyKey: idempotencyKey.current,
        body: {
          productTypeCode: form.productTypeCode,
          specSchemaVersion: form.specSchemaVersion,
          spec,
          ...(form.dimensions.asked && dims.l && dims.w
            ? {
                dimensions: {
                  lengthMm: Number(dims.l),
                  widthMm: Number(dims.w),
                  ...(form.dimensions.height && dims.h ? { heightMm: Number(dims.h) } : {}),
                },
              }
            : {}),
          quantities: [...new Set(quantities.filter((value) => value.trim() !== "").map(Number))],
          ...(targetDate ? { targetDate } : {}),
          deliveryPostcode: postcode,
          fileIds: files.flatMap((file) => (file.file ? [file.file.id] : [])),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(fromProduct
            ? { routedFrom: { catalogProductSlug: fromProduct.slug, reason: "no_instant_price", configuration: {} } }
            : {}),
        },
      });
      track("rfq_submitted", {
        route: "/rfq/[category]",
        productType: form.productTypeCode,
        quantityBand: quantityBand(rfq.quantities[0] ?? 0),
        quoteMode: "rfq",
      });
      router.push(`/account/rfqs/${rfq.id}?submitted=1`);
    } catch (error) {
      // A new attempt after a refusal is a new intent; a network failure may be retried as is.
      if (isApiError(error)) idempotencyKey.current = newKey();
      if (isApiError(error) && error.errors.length > 0) {
        setErrors(Object.fromEntries(error.errors.map((item) => [item.path, item.message])));
      }
      setFailure(isApiError(error) ? error.detail : t("failed"));
      setSubmitting(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // The summary at the top of a long form, announced and focused (design-system.md §4).
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    if (!session) setSignIn(true);
    else void submit();
  }

  async function attach(selected: File[]) {
    const room = form.files.maxFiles - files.length;
    for (const file of selected.slice(0, Math.max(0, room))) {
      const key = newKey();
      setFiles((current) => [...current, { key, name: file.name }]);
      try {
        const uploaded = await uploadFile("customer", file, "document");
        setFiles((current) => current.map((item) => (item.key === key ? { ...item, file: uploaded } : item)));
      } catch {
        setFiles((current) => current.map((item) => (item.key === key ? { ...item, failed: true } : item)));
      }
    }
  }

  const errorList = Object.values(errors);
  const field = (key: string) => errors[key];

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-8">
      <div ref={summaryRef} tabIndex={-1} className="outline-none">
        {errorList.length > 0 ? (
          <Callout tone="danger" live title={t("fixErrors", { count: errorList.length })}>
            <ul className="list-disc ps-5">
              {errorList.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          </Callout>
        ) : null}
        {failure && errorList.length === 0 ? (
          <Callout tone="danger" live>
            {failure}
          </Callout>
        ) : null}
      </div>

      {fromProduct ? <Callout tone="info">{t("fromProduct", { name: fromProduct.name })}</Callout> : null}

      <FormSection title={t("specTitle")}>
        <div className="grid gap-4 sm:grid-cols-2">
          {form.fields.map((entry) => {
            const help = pick(locale, entry.helpTh ?? "", entry.helpEn) || undefined;
            const value = spec[entry.key];
            const set = (next: SpecValue) => setSpec((current) => ({ ...current, [entry.key]: next }));
            if (entry.type === "boolean") {
              return (
                <Checkbox
                  key={entry.key}
                  className="sm:col-span-2"
                  checked={value === true}
                  onCheckedChange={(checked) => set(checked === true)}
                  label={label(entry)}
                  description={help}
                />
              );
            }
            return (
              <Field
                key={entry.key}
                label={label(entry)}
                hint={help}
                required={entry.required}
                requiredLabel={t("requiredMark")}
                error={field(`spec.${entry.key}`)}
                className={entry.type === "textarea" ? "sm:col-span-2" : undefined}
              >
                {entry.type === "select" ? (
                  <Select
                    value={typeof value === "string" ? value : ""}
                    onValueChange={set}
                    placeholder={t("choose")}
                    options={entry.options.map((option) => ({
                      value: option.value,
                      label: pick(locale, option.labelTh, option.labelEn),
                    }))}
                  />
                ) : entry.type === "textarea" ? (
                  <Textarea
                    rows={4}
                    value={typeof value === "string" ? value : ""}
                    onChange={(event) => set(event.target.value)}
                  />
                ) : entry.type === "number" ? (
                  <NumberInput
                    min={entry.min ?? undefined}
                    max={entry.max ?? undefined}
                    unit={entry.unit ?? undefined}
                    value={typeof value === "number" || typeof value === "string" ? String(value) : ""}
                    onChange={(event) => set(event.target.value === "" ? "" : Number(event.target.value))}
                  />
                ) : (
                  <Input value={typeof value === "string" ? value : ""} onChange={(event) => set(event.target.value)} />
                )}
              </Field>
            );
          })}
        </div>
      </FormSection>

      {form.dimensions.asked ? (
        <FormSection title={t("dimensionsTitle")} description={t("dimensionsHint")}>
          <div className="grid grid-cols-3 gap-3">
            {(form.dimensions.height ? (["l", "w", "h"] as const) : (["l", "w"] as const)).map((axis) => (
              <Field
                key={axis}
                label={t(`axes.${axis}`)}
                required={form.dimensions.required}
                requiredLabel={t("requiredMark")}
                error={field(`dims.${axis}`)}
              >
                <NumberInput
                  min={1}
                  unit={t("mm")}
                  value={dims[axis]}
                  onChange={(event) => setDims((current) => ({ ...current, [axis]: event.target.value }))}
                />
              </Field>
            ))}
          </div>
        </FormSection>
      ) : null}

      <FormSection title={t("quantitiesTitle")} description={t("quantitiesHint", { count: form.quantity.maxTiers })}>
        <div className="flex flex-col gap-3">
          {quantities.map((value, index) => (
            <div key={index} className="flex items-end gap-2">
              <Field
                label={t("quantityLabel", { index: index + 1 })}
                error={field(`quantities.${index}`) ?? (index === 0 ? field("quantities") : undefined)}
                className="flex-1"
              >
                <NumberInput
                  min={form.quantity.min}
                  unit={t("pieces")}
                  value={value}
                  onChange={(event) =>
                    setQuantities((current) => current.map((entry, at) => (at === index ? event.target.value : entry)))
                  }
                />
              </Field>
              {quantities.length > 1 ? (
                <IconButton
                  name="trash"
                  variant="ghost"
                  label={t("removeQuantity", { index: index + 1 })}
                  onClick={() => setQuantities((current) => current.filter((_, at) => at !== index))}
                />
              ) : null}
            </div>
          ))}
          {quantities.length < form.quantity.maxTiers ? (
            <Button
              variant="secondary"
              size="sm"
              iconStart="plus"
              className="self-start"
              onClick={() => setQuantities((current) => [...current, ""])}
            >
              {t("addQuantity")}
            </Button>
          ) : null}
        </div>
      </FormSection>

      <FormSection title={t("deliveryTitle")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("postcode")} required requiredLabel={t("requiredMark")} error={field("postcode")}>
            <Input
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              value={postcode}
              onChange={(event) => setPostcode(event.target.value.replace(/\D/g, "").slice(0, 5))}
            />
          </Field>
          <Field label={t("targetDate")} hint={t("targetDateHint")}>
            <Input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
          </Field>
        </div>
      </FormSection>

      <FormSection title={t("filesTitle")} description={t("filesHint")}>
        <div className="flex flex-col gap-3">
          <FileDropzone
            multiple
            accept={form.files.accept}
            maxBytes={form.files.maxBytes}
            disabled={files.length >= form.files.maxFiles}
            onFiles={(selected) => void attach(selected)}
            labels={{
              prompt: t("dropPrompt"),
              browse: t("browse"),
              hint: t("fileRules", { max: format.bytes(form.files.maxBytes), count: form.files.maxFiles }),
              tooLarge: (name) => t("tooLarge", { name }),
              wrongType: (name) => t("wrongType", { name }),
            }}
          />
          {field("files") ? <p className="text-danger text-xs font-medium">{field("files")}</p> : null}
          {files.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {files.map((file) => (
                <li
                  key={file.key}
                  className="border-border flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span className={file.failed ? "text-danger text-xs" : "text-muted text-xs"}>
                    {file.failed ? t("uploadFailed") : file.file ? t("uploaded") : t("uploading")}
                  </span>
                  <IconButton
                    name="close"
                    size="sm"
                    variant="ghost"
                    label={t("removeFile", { name: file.name })}
                    onClick={() => setFiles((current) => current.filter((item) => item.key !== file.key))}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </FormSection>

      <FormSection title={t("notesTitle")}>
        <Field label={t("notes")} hint={t("notesHint")}>
          <Textarea rows={4} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </FormSection>

      <div className="flex flex-col gap-2">
        <p className="text-muted text-sm">{t("sla", { hours: form.slaTargetHours })}</p>
        <Button type="submit" size="lg" loading={submitting} className="self-start">
          {t("submit")}
        </Button>
        {!session ? <p className="text-muted text-xs">{t("signInNote")}</p> : null}
      </div>

      {signIn ? (
        <SignInSheet
          open={signIn}
          onOpenChange={setSignIn}
          onSignedIn={() => {
            setSignIn(false);
            setSession(true);
            router.refresh();
            void submit();
          }}
        />
      ) : null}
    </form>
  );
}
