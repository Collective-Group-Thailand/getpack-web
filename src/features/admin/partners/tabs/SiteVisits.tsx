"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { SITE_VISIT_RESULT } from "@/domain/status";
import { uploadFile } from "@/features/shared/files/upload";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { toast } from "@/ui/components/Toast";

import { StatusChip, useCan } from "../../console";
import { adminBrowserApis } from "../../console/api";
import { useFactoryPart, useFactoryRefresh } from "../hooks";
import { FormDialog, Section } from "../parts";
import type { Factory } from "../resources";

/** The checklist the visit form records, versioned so an old visit keeps its meaning. */
const CHECKLIST = ["safety", "qualityControl", "storage", "capacityVerified", "hygiene"] as const;
const CHECKLIST_VERSION = "2026.1";
type Mark = "pass" | "fix" | "fail";

/**
 * Site visits (D-041): at least one passed visit is required before a factory can be activated,
 * so a failed or conditional one says what to fix, and activation stays unavailable until then.
 */
export function SiteVisits({ factory }: { factory: Factory }) {
  const t = useTranslations("partners.visits");
  const canRecord = useCan("partners.site_visits.record");
  const refresh = useFactoryRefresh(factory.id);
  const visits = useFactoryPart(factory.id, "/v1/admin/factories/{factoryId}/site-visits");
  const [open, setOpen] = useState(false);
  const [visitedOn, setVisitedOn] = useState("");
  const [result, setResult] = useState<Schemas["SiteVisitResult"]>("pass");
  const [marks, setMarks] = useState<Record<string, Mark>>(Object.fromEntries(CHECKLIST.map((key) => [key, "pass"])));
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const passed = (visits.data ?? []).some((visit) => visit.result === "pass");

  return (
    <Section
      title={t("title")}
      actions={
        canRecord ? (
          <Button size="sm" variant="secondary" iconStart="plus" onClick={() => setOpen(true)}>
            {t("record")}
          </Button>
        ) : null
      }
    >
      {!passed && ["under_review", "trial"].includes(factory.status) ? (
        <Callout tone="warning" title={t("required")} className="mb-3" />
      ) : null}
      {(visits.data ?? []).length === 0 ? <p className="text-muted text-sm">{t("none")}</p> : null}
      <ul className="flex flex-col gap-3">
        {(visits.data ?? []).map((visit) => (
          <li key={visit.id} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{visit.visitedOn}</span>
              <StatusChip map={SITE_VISIT_RESULT} value={visit.result} />
              <span className="text-muted text-xs">{t("checklistVersion", { version: visit.checklistVersion })}</span>
            </div>
            <DescriptionList
              className="mt-2"
              columns={3}
              items={Object.entries(visit.checklist).map(([key, value]) => ({
                term: t.has(`items.${key}`) ? t(`items.${key}`) : key,
                description: t.has(`marks.${String(value)}`) ? t(`marks.${String(value)}`) : String(value),
              }))}
            />
            {visit.notes ? <p className="mt-2 text-sm">{visit.notes}</p> : null}
            <p className="text-muted mt-1 text-xs">{t("photos", { count: visit.photoFileIds.length })}</p>
          </li>
        ))}
      </ul>

      {open ? (
        <FormDialog
          title={t("record")}
          description={t("recordBody", { code: factory.code })}
          submitLabel={t("save")}
          onClose={() => setOpen(false)}
          onSubmit={async () => {
            const uploaded = await Promise.all(photos.map((photo) => uploadFile("admin", photo, "evidence")));
            await adminBrowserApis().contract.POST("/v1/admin/factories/{factoryId}/site-visits", {
              params: { path: { factoryId: factory.id } },
              body: {
                visitedOn,
                result,
                checklist: marks,
                checklistVersion: CHECKLIST_VERSION,
                inspectorIds: [],
                photoFileIds: uploaded.map((item) => item.id),
                notes: notes.trim() || null,
              },
            });
            toast.success(t("saved"));
            refresh();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("visitedOn")} required>
              <Input type="date" value={visitedOn} onChange={(event) => setVisitedOn(event.target.value)} />
            </Field>
            <Field label={t("result")}>
              <SearchableSelect
                value={result}
                onValueChange={(value) => setResult(value as Schemas["SiteVisitResult"])}
                options={(["pass", "conditional", "fail"] as const).map((value) => ({
                  value,
                  label: t(`results.${value}`),
                }))}
              />
            </Field>
          </div>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">{t("checklist")}</legend>
            {CHECKLIST.map((key) => (
              <Field key={key} label={t(`items.${key}`)}>
                <SearchableSelect
                  value={marks[key]}
                  onValueChange={(value) => setMarks({ ...marks, [key]: value as Mark })}
                  options={(["pass", "fix", "fail"] as const).map((value) => ({ value, label: t(`marks.${value}`) }))}
                />
              </Field>
            ))}
          </fieldset>
          <Field label={t("notes")} hint={t("notesHint")}>
            <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          <FileDropzone
            accept="image/*"
            multiple
            maxBytes={20 * 1024 * 1024}
            onFiles={(files) => setPhotos(files.slice(0, 10))}
            labels={{
              prompt: photos.length ? t("photosChosen", { count: photos.length }) : t("drop"),
              browse: t("browse"),
              tooLarge: (name) => t("tooLarge", { name }),
              wrongType: (name) => t("wrongType", { name }),
            }}
          />
        </FormDialog>
      ) : null}
    </Section>
  );
}
