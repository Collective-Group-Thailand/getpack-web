"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { useErpCall } from "@/features/partner/erp/call";
import { FormColumns, FormSummary, SummaryRows } from "@/features/partner/form-layout";
import { Select } from "@/features/partner/select";
import { signedUrl } from "@/features/partner/viewer";
import { ConfirmAction } from "@/features/shared/actions";
import { uploadFile } from "@/features/shared/files/upload";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";
import { Field, FormSection } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

type Doc = Schemas["ErpDocDto"];
type Folder = Schemas["ErpDocFolderDto"];
type Category = Schemas["ErpDocCategory"];
type LinkType = Schemas["ErpDocLink"];

export const DOC_CATEGORIES = [
  "certificate",
  "permit",
  "contract",
  "drawing",
  "specification",
  "manual",
  "procedure",
  "other",
] as const satisfies readonly Category[];

/** Records a document can be linked to, picked by name: those the user may read. */
export type LinkTargets = Partial<Record<LinkType, { id: string; label: string }[]>>;

const NONE = "none";
const NO_FOLDER = "root";
const ACCEPT = "application/pdf,image/*,.dwg,.dxf,.doc,.docx,.xls,.xlsx";
const MAX_BYTES = 50 * 1024 * 1024;

function useFileDropLabels(file: File | null) {
  const t = useTranslations("partnerOps.documents.form");
  return {
    prompt: file ? t("chosen", { name: file.name }) : t("drop"),
    browse: t("browse"),
    hint: t("fileHint"),
    tooLarge: (name: string) => t("tooLarge", { name }),
    wrongType: (name: string) => t("wrongType", { name }),
  };
}

/**
 * Add a document or edit its details (D-356): a title, a kind, a folder, tags, what it belongs to and when
 * it expires. A new document carries its first file; later files are versions.
 */
export function DocumentForm({
  folders,
  targets,
  prefill,
  doc,
  etag,
}: {
  folders: Folder[];
  targets: LinkTargets;
  prefill?: { linkType?: LinkType; linkId?: string; label?: string; folderId?: string };
  doc?: Doc;
  etag?: string | null;
}) {
  const t = useTranslations("partnerOps.documents");
  const tCommon = useTranslations("partnerErp.common");
  const tShared = useTranslations("partnerOps.shared");
  const router = useRouter();
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  const fixed =
    doc?.link ??
    (prefill?.linkType && prefill.linkId
      ? { type: prefill.linkType, id: prefill.linkId, label: prefill.label ?? prefill.linkId }
      : null);
  const [title, setTitle] = useState(doc?.title ?? "");
  const [category, setCategory] = useState<Category>(doc?.category ?? "certificate");
  const [folderId, setFolderId] = useState(doc?.folder?.id ?? prefill?.folderId ?? NO_FOLDER);
  const [tags, setTags] = useState(doc?.tags.join(", ") ?? "");
  const [linkType, setLinkType] = useState<LinkType | typeof NONE>(fixed?.type ?? NONE);
  const [linkId, setLinkId] = useState(fixed?.id ?? "");
  const [expiresOn, setExpiresOn] = useState(doc?.expiresOn ?? "");
  const [remindDays, setRemindDays] = useState(String(doc?.remindDays ?? 30));
  const [note, setNote] = useState(doc?.note ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ title?: string; file?: string; link?: string }>({});
  const labels = useFileDropLabels(file);

  const linkTypes = [...new Set<LinkType>([...(Object.keys(targets) as LinkType[]), ...(fixed ? [fixed.type] : [])])];
  const targetOptions =
    linkType === NONE
      ? []
      : [
          ...(fixed && fixed.type === linkType && !targets[linkType]?.some((x) => x.id === fixed.id)
            ? [{ value: fixed.id, label: fixed.label }]
            : []),
          ...(targets[linkType] ?? []).map((x) => ({ value: x.id, label: x.label })),
        ];

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const next = {
      ...(title.trim().length >= 2 ? {} : { title: t("form.titleRequired") }),
      ...(doc || file ? {} : { file: t("form.fileRequired") }),
      ...(linkType === NONE || linkId ? {} : { link: t("form.linkRequired") }),
    };
    setErrors(next);
    if (Object.keys(next).length) return;
    const common = {
      title: title.trim(),
      category,
      folderId: folderId === NO_FOLDER ? null : folderId,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      linkType: linkType === NONE ? null : linkType,
      linkId: linkType === NONE ? null : linkId,
      expiresOn: expiresOn || null,
      remindDays: Math.max(0, Number.parseInt(remindDays, 10) || 0),
      note: note.trim() || null,
    };
    const saved = await call(
      async () => {
        if (doc)
          return (
            await browserApi().PATCH("/v1/partner/factories/{factoryId}/erp/documents/{docId}", {
              params: { path: { factoryId, docId: doc.id }, header: { "If-Match": etag ?? "*" } },
              body: common,
            })
          ).data;
        const uploaded = await uploadFile("partner", file!, "document", { factoryId });
        return (
          await browserApi().POST("/v1/partner/factories/{factoryId}/erp/documents", {
            params: { path: { factoryId } },
            body: { ...common, fileId: uploaded.id },
          })
        ).data;
      },
      t("form.saved"),
      { refresh: false },
    );
    if (saved) {
      router.push(`/documents/${saved.id}`);
      router.refresh();
    }
  }

  // Numbered sections on the left, what the record will say on the right (with the one save) — the ERP form frame.
  const step = (n: number) => (doc ? n - 1 : n);
  const target = targetOptions.find((o) => o.value === linkId)?.label;
  const linkLabel =
    linkType === NONE
      ? t("links.none")
      : target
        ? tShared("labelled", { label: t(`links.${linkType}`), value: target })
        : t(`links.${linkType}`);
  return (
    <form onSubmit={(event) => void save(event)} noValidate>
      <FormColumns
        aside={
          <FormSummary
            title={tCommon("sections.summary")}
            action={
              <Button type="submit" size="xl" iconStart="save" loading={busy}>
                {t("form.save")}
              </Button>
            }
          >
            <SummaryRows
              rows={[
                ...(doc ? [] : [{ key: "file", label: t("form.file"), value: file?.name ?? "" }]),
                { key: "title", label: t("form.title"), value: title.trim() },
                { key: "category", label: t("form.category"), value: t(`categories.${category}`) },
                {
                  key: "folder",
                  label: t("form.folder"),
                  value:
                    folderId === NO_FOLDER ? t("form.noFolder") : (folders.find((f) => f.id === folderId)?.name ?? ""),
                },
                { key: "link", label: t("form.linkType"), value: linkLabel },
                { key: "expires", label: t("form.expiresOn"), value: expiresOn },
              ]}
            />
          </FormSummary>
        }
      >
        {doc ? null : (
          <FormSection card step={1} title={t("form.file")}>
            <Field label={t("form.file")} required requiredLabel={tCommon("required")} error={errors.file}>
              <FileDropzone
                accept={ACCEPT}
                maxBytes={MAX_BYTES}
                onFiles={(files) => {
                  const first = files[0] ?? null;
                  setFile(first);
                  if (first && !title) setTitle(first.name.replace(/\.[^.]+$/, ""));
                }}
                labels={labels}
              />
            </Field>
          </FormSection>
        )}
        <FormSection card step={step(2)} title={tCommon("sections.details")}>
          <Field label={t("form.title")} required requiredLabel={tCommon("required")} error={errors.title}>
            <Input
              value={title}
              maxLength={200}
              placeholder={t("form.titlePlaceholder")}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.category")}>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as Category)}
                options={DOC_CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) }))}
              />
            </Field>
            <Field label={t("form.folder")}>
              <Select
                value={folderId}
                onValueChange={setFolderId}
                options={[
                  { value: NO_FOLDER, label: t("form.noFolder") },
                  ...folders.map((f) => ({ value: f.id, label: f.name })),
                ]}
              />
            </Field>
          </div>
          <Field label={t("form.tags")} hint={t("form.tagsHint")}>
            <Input value={tags} maxLength={300} onChange={(event) => setTags(event.target.value)} />
          </Field>
        </FormSection>
        <FormSection card step={step(3)} title={tCommon("sections.affected")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.linkType")}>
              <Select
                value={linkType}
                onValueChange={(value) => {
                  setLinkType(value as LinkType | typeof NONE);
                  setLinkId(fixed && fixed.type === value ? fixed.id : "");
                }}
                options={[
                  { value: NONE, label: t("links.none") },
                  ...linkTypes.map((type) => ({ value: type, label: t(`links.${type}`) })),
                ]}
              />
            </Field>
            {linkType === NONE ? null : (
              <Field label={t("form.linkTarget")} error={errors.link}>
                <Select
                  value={linkId || null}
                  placeholder={t("form.linkTarget")}
                  onValueChange={setLinkId}
                  options={targetOptions}
                />
              </Field>
            )}
          </div>
        </FormSection>
        <FormSection card step={step(4)} title={t("form.expiresOn")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.expiresOn")}>
              <Input type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} />
            </Field>
            <Field label={t("form.remindDays")}>
              <NumberInput
                min={0}
                max={365}
                step={1}
                disabled={!expiresOn}
                value={remindDays}
                onChange={(event) => setRemindDays(event.target.value)}
              />
            </Field>
          </div>
          <Field label={t("form.note")}>
            <Textarea rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        </FormSection>
      </FormColumns>
    </form>
  );
}

/** Upload a new version (D-356): a renewed certificate or a revised drawing, with its new expiry. */
export function NewVersionButton({
  doc,
  variant = "primary",
}: {
  doc: Doc;
  /** "secondary" under the panel's filled primary. */
  variant?: "primary" | "secondary";
}) {
  const t = useTranslations("partnerOps.documents");
  const tCommon = useTranslations("partnerErp.common");
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [expiresOn, setExpiresOn] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const labels = useFileDropLabels(file);

  return (
    <>
      <Button variant={variant} iconStart="upload" onClick={() => setOpen(true)}>
        {t("newVersion")}
      </Button>
      {open ? (
        <Dialog
          open
          onOpenChange={setOpen}
          title={t("newVersionTitle", { title: doc.title })}
          closeLabel={tCommon("cancel")}
          footer={
            <Button
              iconStart="upload"
              loading={busy}
              onClick={async () => {
                if (!file) {
                  setError(t("form.fileRequired"));
                  return;
                }
                const ok = await call(async () => {
                  const uploaded = await uploadFile("partner", file, "document", { factoryId });
                  return browserApi().POST("/v1/partner/factories/{factoryId}/erp/documents/{docId}/versions", {
                    params: { path: { factoryId, docId: doc.id }, header: { "Idempotency-Key": key } },
                    body: { fileId: uploaded.id, ...(expiresOn ? { expiresOn } : {}), note: note.trim() || null },
                  });
                }, t("versionAdded"));
                if (ok) {
                  setOpen(false);
                  setFile(null);
                  setNote("");
                  setExpiresOn("");
                  setKey(crypto.randomUUID());
                }
              }}
            >
              {t("newVersion")}
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            <Field label={t("form.file")} error={error}>
              <FileDropzone
                accept={ACCEPT}
                maxBytes={MAX_BYTES}
                onFiles={(files) => {
                  setFile(files[0] ?? null);
                  setError(undefined);
                }}
                labels={labels}
              />
            </Field>
            <Field label={t("newExpiry")}>
              <Input type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} />
            </Field>
            <Field label={t("versionNote")}>
              <Textarea rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

/** Open a stored file through a short-lived signed link. */
export function OpenFileButton({
  fileId,
  label,
  variant = "secondary",
  size = "sm",
}: {
  fileId: string;
  label: string;
  /** "primary" in a record's action panel, where opening the file is the page's job. */
  variant?: "primary" | "secondary";
  size?: "sm" | "lg";
}) {
  const tCommon = useTranslations("partnerErp.common");
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={variant}
      size={size}
      iconStart="download"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          window.open(await signedUrl(fileId), "_blank", "noopener");
        } catch {
          toast.error(tCommon("failed"));
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );
}

/** Archive a document (kept, out of the lists and reminders) or bring it back. */
export function ArchiveDocButton({ doc, etag }: { doc: Doc; etag: string | null }) {
  const t = useTranslations("partnerOps.documents");
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  const archived = doc.status === "archived";
  return (
    <Button
      variant="ghost"
      iconStart={archived ? "undo" : "archive"}
      loading={busy}
      onClick={() =>
        void call(
          () =>
            browserApi().PATCH("/v1/partner/factories/{factoryId}/erp/documents/{docId}", {
              params: { path: { factoryId, docId: doc.id }, header: { "If-Match": etag ?? "*" } },
              body: { status: archived ? "active" : "archived" },
            }),
          archived ? t("form.restored") : t("form.archived"),
        )
      }
    >
      {archived ? t("restore") : t("archive")}
    </Button>
  );
}

/** New folder, rename, and delete (an empty one), next to the folder list. */
export function FolderActions({ folder }: { folder?: Folder }) {
  const t = useTranslations("partnerOps.documents");
  const tCommon = useTranslations("partnerErp.common");
  const router = useRouter();
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  const [mode, setMode] = useState<"create" | "rename" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState("");

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="secondary"
        iconStart="plus"
        onClick={() => {
          setName("");
          setMode("create");
        }}
      >
        {t("newFolder")}
      </Button>
      {folder ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            iconStart="edit"
            onClick={() => {
              setName(folder.name);
              setMode("rename");
            }}
          >
            {t("renameFolder")}
          </Button>
          {folder.docCount === 0 ? (
            <>
              <Button size="sm" variant="ghost" iconStart="trash" onClick={() => setDeleting(true)}>
                {t("deleteFolder")}
              </Button>
              <ConfirmAction
                open={deleting}
                onOpenChange={setDeleting}
                title={t("deleteFolderTitle", { name: folder.name })}
                description={t("deleteFolderBody")}
                confirmLabel={t("deleteFolder")}
                tone="destructive"
                onConfirm={async () => {
                  const ok = await call(
                    () =>
                      browserApi().DELETE("/v1/partner/factories/{factoryId}/erp/documents/folders/{folderId}", {
                        params: { path: { factoryId, folderId: folder.id } },
                      }),
                    t("folderDeleted"),
                    { refresh: false },
                  );
                  if (ok) {
                    setDeleting(false);
                    router.push("/documents");
                    router.refresh();
                  }
                }}
              />
            </>
          ) : null}
        </>
      ) : null}
      {mode ? (
        <Dialog
          open
          onOpenChange={(o) => !o && setMode(null)}
          title={mode === "create" ? t("newFolder") : t("renameFolder")}
          closeLabel={tCommon("cancel")}
          footer={
            <Button
              iconStart="save"
              loading={busy}
              disabled={name.trim().length < 1}
              onClick={async () => {
                const ok = await call(
                  () =>
                    mode === "rename" && folder
                      ? browserApi().PATCH("/v1/partner/factories/{factoryId}/erp/documents/folders/{folderId}", {
                          params: { path: { factoryId, folderId: folder.id } },
                          body: { name: name.trim() },
                        })
                      : browserApi().POST("/v1/partner/factories/{factoryId}/erp/documents/folders", {
                          params: { path: { factoryId } },
                          body: { name: name.trim() },
                        }),
                  mode === "rename" ? t("folderRenamed") : t("folderCreated"),
                );
                if (ok) setMode(null);
              }}
            >
              {tCommon("save")}
            </Button>
          }
        >
          <Field label={t("folderName")}>
            <Input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
          </Field>
        </Dialog>
      ) : null}
    </div>
  );
}
