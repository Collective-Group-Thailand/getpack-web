"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { today } from "@/features/admin/console/dates";
import { When } from "@/features/shared/format";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage, QueryError, Section, useCan } from "../console";
import {
  cleanContent,
  contentErrors,
  type ContentError,
  isExpired,
  type LibraryContent,
  LIMITS,
  newCertification,
  newFoodGradeDoc,
  newLogo,
  newPhoto,
  type Trust,
} from "./content-form";

const KEY = ["admin", "style-library", "settings"] as const;

async function read() {
  const { data } = await adminBrowserApis().contract.GET("/v1/admin/style-library/settings");
  return data!;
}

/**
 * The /styles page content staff keep (C1c, DECISIONS-STAGE-A §11.5, D-448): the trust section —
 * certificates (name, number, issuer, expiry, document), food-grade documents, production-process
 * photos, customer logos with where the customer's permission is recorded, the tax-invoice note.
 * Saved as a new version of `storefront.style_library` with a reason (audited); Admin and Marketing
 * (`styles.curate`) edit, others read. Nothing is pre-filled: the storefront hides a part while it
 * is empty.
 */
export function StyleLibraryContentEditor() {
  const query = useQuery({ queryKey: KEY, queryFn: read });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return null;
  return <Editor key={query.data.versionNo ?? 0} loaded={query.data} />;
}

type Loaded = Awaited<ReturnType<typeof read>>;

function Editor({ loaded }: { loaded: Loaded }) {
  const t = useTranslations("styleLibrary.content");
  const canCurate = useCan("styles.curate");
  const queryClient = useQueryClient();
  const [content, setContent] = useState<LibraryContent>(loaded.content);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<ContentError[]>([]);
  const day = today();

  const setTrust = <K extends keyof Trust>(key: K, value: Trust[K]) =>
    setContent((c) => ({ ...c, trust: { ...c.trust, [key]: value } }));
  const update = <K extends "certifications" | "foodGrade" | "productionPhotos" | "customerLogos">(
    key: K,
    index: number,
    patch: Partial<Trust[K][number]>,
  ) => setTrust(key, content.trust[key].map((row, i) => (i === index ? { ...row, ...patch } : row)) as Trust[K]);
  const remove = (key: "certifications" | "foodGrade" | "productionPhotos" | "customerLogos", index: number) =>
    setTrust(key, content.trust[key].filter((_, i) => i !== index) as never);
  const errorAt = (path: string) => {
    const e = errors.find((x) => x.path === path);
    return e ? t(`errors.${e.code}`) : undefined;
  };

  const save = useMutation({
    mutationFn: async () => {
      const problems = contentErrors(content);
      if (reason.trim().length < 3) problems.push({ path: "reason", code: "required" });
      setErrors(problems);
      if (problems.length) throw new Error("invalid");
      const { data } = await adminBrowserApis().contract.PUT("/v1/admin/style-library/settings", {
        body: { content: cleanContent(content), reason: reason.trim() },
      });
      return data!;
    },
    onSuccess: (data) => {
      toast.success(t("saved"));
      queryClient.setQueryData(KEY, data);
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "invalid") return toast.error(t("fixErrors"));
      toast.error(problemMessage(error, t("failed")));
    },
  });

  const disabled = !canCurate;
  const localisedFields = (
    prefix: string,
    value: { th: string; en: string | null },
    onChange: (v: { th: string; en: string | null }) => void,
    labels: { th: string; en: string },
  ) => (
    <>
      <Field label={labels.th} required error={errorAt(prefix)}>
        <Input value={value.th} disabled={disabled} onChange={(e) => onChange({ ...value, th: e.target.value })} />
      </Field>
      <Field label={labels.en}>
        <Input
          value={value.en ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, en: e.target.value || null })}
        />
      </Field>
    </>
  );
  const addButton = (label: string, full: boolean, onClick: () => void) =>
    canCurate ? (
      <Button type="button" variant="secondary" iconStart="plus" disabled={full} onClick={onClick}>
        {label}
      </Button>
    ) : null;
  const removeButton = (onClick: () => void) =>
    canCurate ? (
      <Button type="button" variant="ghost" size="sm" onClick={onClick}>
        {t("remove")}
      </Button>
    ) : null;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
      data-testid="style-library-content"
    >
      {!canCurate ? <Callout tone="info" title={t("readOnly")} /> : null}
      <p className="text-muted text-sm">
        {loaded.versionNo ? (
          <>
            {t("version", { version: loaded.versionNo })} · <When at={loaded.effectiveFrom} />
          </>
        ) : (
          t("unset")
        )}
      </p>
      <Callout tone="warning" title={t("realOnlyTitle")}>
        {t("realOnly")}
      </Callout>

      <Section
        title={t("certificationsTitle")}
        description={t("certificationsIntro")}
        actions={addButton(t("addCertification"), content.trust.certifications.length >= LIMITS.certifications, () =>
          setTrust("certifications", [...content.trust.certifications, newCertification()]),
        )}
      >
        {content.trust.certifications.length === 0 ? <p className="text-muted text-sm">{t("none")}</p> : null}
        <ol className="flex flex-col gap-4">
          {content.trust.certifications.map((c, i) => (
            <li key={i} className="border-border rounded-card grid gap-3 border p-4 md:grid-cols-2" data-row="certification">
              <div className="flex items-center justify-between gap-2 md:col-span-2">
                <span className="text-sm font-medium tabular-nums">{t("certificationN", { n: i + 1 })}</span>
                <span className="flex items-center gap-2">
                  {isExpired(c, day) ? <Badge tone="warning">{t("expired")}</Badge> : null}
                  {removeButton(() => remove("certifications", i))}
                </span>
              </div>
              {localisedFields(`trust.certifications.${i}.title`, c.title, (title) => update("certifications", i, { title }), {
                th: t("nameTh"),
                en: t("nameEn"),
              })}
              <Field label={t("number")}>
                <Input value={c.number ?? ""} disabled={disabled} onChange={(e) => update("certifications", i, { number: e.target.value })} />
              </Field>
              <Field label={t("issuer")}>
                <Input value={c.issuer ?? ""} disabled={disabled} onChange={(e) => update("certifications", i, { issuer: e.target.value })} />
              </Field>
              <Field label={t("expiresOn")} hint={t("expiresOnHint")} error={errorAt(`trust.certifications.${i}.expiresOn`)}>
                <Input
                  type="date"
                  value={c.expiresOn ?? ""}
                  disabled={disabled}
                  onChange={(e) => update("certifications", i, { expiresOn: e.target.value || null })}
                />
              </Field>
              <Field label={t("documentUrl")} hint={t("urlHint")} error={errorAt(`trust.certifications.${i}.documentUrl`)}>
                <Input
                  value={c.documentUrl ?? ""}
                  disabled={disabled}
                  onChange={(e) => update("certifications", i, { documentUrl: e.target.value })}
                />
              </Field>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        title={t("foodGradeTitle")}
        description={t("foodGradeIntro")}
        actions={addButton(t("addFoodGrade"), content.trust.foodGrade.length >= LIMITS.foodGrade, () =>
          setTrust("foodGrade", [...content.trust.foodGrade, newFoodGradeDoc()]),
        )}
      >
        {content.trust.foodGrade.length === 0 ? <p className="text-muted text-sm">{t("none")}</p> : null}
        <ol className="flex flex-col gap-4">
          {content.trust.foodGrade.map((f, i) => (
            <li key={i} className="border-border rounded-card grid gap-3 border p-4 md:grid-cols-3" data-row="food-grade">
              {localisedFields(`trust.foodGrade.${i}.title`, f.title, (title) => update("foodGrade", i, { title }), {
                th: t("documentTh"),
                en: t("documentEn"),
              })}
              <Field label={t("documentUrl")} hint={t("urlHint")} error={errorAt(`trust.foodGrade.${i}.documentUrl`)}>
                <Input value={f.documentUrl ?? ""} disabled={disabled} onChange={(e) => update("foodGrade", i, { documentUrl: e.target.value })} />
              </Field>
              <div className="md:col-span-3">{removeButton(() => remove("foodGrade", i))}</div>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        title={t("photosTitle")}
        description={t("photosIntro")}
        actions={addButton(t("addPhoto"), content.trust.productionPhotos.length >= LIMITS.productionPhotos, () =>
          setTrust("productionPhotos", [...content.trust.productionPhotos, newPhoto()]),
        )}
      >
        {content.trust.productionPhotos.length === 0 ? <p className="text-muted text-sm">{t("none")}</p> : null}
        <ol className="flex flex-col gap-4">
          {content.trust.productionPhotos.map((p, i) => (
            <li key={i} className="border-border rounded-card grid gap-3 border p-4 md:grid-cols-3" data-row="photo">
              <Field label={t("photoUrl")} hint={t("urlHint")} required error={errorAt(`trust.productionPhotos.${i}.url`)}>
                <Input value={p.url} disabled={disabled} onChange={(e) => update("productionPhotos", i, { url: e.target.value })} />
              </Field>
              {localisedFields(`trust.productionPhotos.${i}.alt`, p.alt, (alt) => update("productionPhotos", i, { alt }), {
                th: t("altTh"),
                en: t("altEn"),
              })}
              <div className="md:col-span-3">{removeButton(() => remove("productionPhotos", i))}</div>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        title={t("logosTitle")}
        description={t("logosIntro")}
        actions={addButton(t("addLogo"), content.trust.customerLogos.length >= LIMITS.customerLogos, () =>
          setTrust("customerLogos", [...content.trust.customerLogos, newLogo()]),
        )}
      >
        {content.trust.customerLogos.length === 0 ? <p className="text-muted text-sm">{t("none")}</p> : null}
        <ol className="flex flex-col gap-4">
          {content.trust.customerLogos.map((l, i) => (
            <li key={i} className="border-border rounded-card grid gap-3 border p-4 md:grid-cols-3" data-row="logo">
              <Field label={t("logoName")} required error={errorAt(`trust.customerLogos.${i}.name`)}>
                <Input value={l.name} disabled={disabled} onChange={(e) => update("customerLogos", i, { name: e.target.value })} />
              </Field>
              <Field label={t("logoUrl")} hint={t("urlHint")} required error={errorAt(`trust.customerLogos.${i}.logoUrl`)}>
                <Input value={l.logoUrl} disabled={disabled} onChange={(e) => update("customerLogos", i, { logoUrl: e.target.value })} />
              </Field>
              <Field label={t("permission")} hint={t("permissionHint")} required error={errorAt(`trust.customerLogos.${i}.permission`)}>
                <Input value={l.permission} disabled={disabled} onChange={(e) => update("customerLogos", i, { permission: e.target.value })} />
              </Field>
              <div className="md:col-span-3">{removeButton(() => remove("customerLogos", i))}</div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title={t("taxTitle")} description={t("taxIntro")}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("taxTh")} error={errorAt("trust.taxInvoiceNote")}>
            <Textarea
              rows={3}
              value={content.trust.taxInvoiceNote?.th ?? ""}
              disabled={disabled}
              onChange={(e) =>
                setTrust("taxInvoiceNote", { th: e.target.value, en: content.trust.taxInvoiceNote?.en ?? null })
              }
            />
          </Field>
          <Field label={t("taxEn")}>
            <Textarea
              rows={3}
              value={content.trust.taxInvoiceNote?.en ?? ""}
              disabled={disabled}
              onChange={(e) =>
                setTrust("taxInvoiceNote", { th: content.trust.taxInvoiceNote?.th ?? "", en: e.target.value || null })
              }
            />
          </Field>
        </div>
      </Section>

      {canCurate ? (
        <Section title={t("saveTitle")}>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <Field label={t("reason")} hint={t("reasonHint")} required error={errorAt("reason")} className="flex-1">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <Button type="submit" loading={save.isPending}>
              {t("save")}
            </Button>
          </div>
        </Section>
      ) : null}
    </form>
  );
}
