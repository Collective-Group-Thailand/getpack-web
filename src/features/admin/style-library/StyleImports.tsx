"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { uploadFile } from "@/features/shared/files/upload";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { Dialog } from "@/ui/components/Dialog";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, ConfirmAction, problemMessage, ResourceList, useCan, type InitialPage } from "../console";
import { importsList, type StyleImportPreview, type StyleImportRun } from "./resources";

type Kind = StyleImportPreview["kind"];
type Change = Record<string, unknown> & { op?: string; code?: string };

const STATUS_TONE: Record<StyleImportRun["status"], "success" | "warning" | "danger"> = {
  applied: "success",
  pending_approval: "warning",
  rejected: "danger",
};

/** "เพิ่มแบบย่อย 3 · ปิด 1" — what one change does, from the run's brief of it. */
function useChangeWords() {
  const t = useTranslations("styleLibrary.imports.change");
  return (change: Change) => {
    const parts: string[] = [];
    const n = (key: string) => (typeof change[key] === "number" ? (change[key] as number) : 0);
    if (change.op === "base.create") parts.push(t("create", { count: n("variants") }));
    if (change.op === "base.retire") parts.push(t("retire"));
    if (change.op === "recipe.create") parts.push(t("recipe"));
    if (Array.isArray(change["fields"]) && (change["fields"] as string[]).length)
      parts.push(t("fields", { fields: (change["fields"] as string[]).join(", ") }));
    if (n("addVariants")) parts.push(t("addVariants", { count: n("addVariants") }));
    if (n("retireVariants")) parts.push(t("retireVariants", { count: n("retireVariants") }));
    if (n("reviveVariants")) parts.push(t("reviveVariants", { count: n("reviveVariants") }));
    if (change["synonyms"] === true) parts.push(t("synonyms"));
    if (change["useCases"] === true) parts.push(t("useCases"));
    return parts.join(" · ") || t("other");
  };
}

/**
 * The style library's imports (D-242, D-411): every run with what it changed and whether its
 * changes to published styles wait for Prepress, then Marketing — and a new import from here: the
 * master file or a recipe bundle as JSON, previewed (nothing written), then confirmed exactly as
 * previewed. The same file twice, or one that changes nothing, writes nothing.
 */
export function StyleImports({ initial }: { initial: InitialPage<StyleImportRun> | null }) {
  const t = useTranslations("styleLibrary.imports");
  const format = useFormat();
  const canImport = useCan("styles.import");
  const queryClient = useQueryClient();
  const words = useChangeWords();
  const [kind, setKind] = useState<Kind>("master");
  const [preview, setPreview] = useState<(StyleImportPreview & { fileId: string }) | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState<StyleImportRun | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const typed = file.type ? file : new File([file], file.name, { type: "application/json" });
      const uploaded = await uploadFile("admin", typed, "import");
      const { data } = await adminBrowserApis().contract.POST("/v1/admin/style-imports/actions/preview", {
        body: { kind, fileId: uploaded.id },
      });
      return { ...data!, fileId: uploaded.id };
    },
    onSuccess: setPreview,
    onError: (error) => toast.error(problemMessage(error, t("previewFailed"))),
  });

  const columns: DataTableColumn<StyleImportRun>[] = [
    {
      id: "fileName",
      header: t("columns.file"),
      cell: (row) => (
        <div className="min-w-0">
          <button
            type="button"
            className="text-primary text-start font-medium hover:underline"
            onClick={() => setOpen(row)}
          >
            {row.fileName}
          </button>
          <p className="text-muted font-mono text-xs">{row.checksum.slice(0, 12)}</p>
        </div>
      ),
    },
    { id: "kind", header: t("columns.kind"), cell: (row) => t(`kinds.${row.kind}`) },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => (
        <Badge tone={STATUS_TONE[row.status]} size="sm">
          {t(`statuses.${row.status}`)}
        </Badge>
      ),
    },
    {
      id: "summary",
      header: t("columns.summary"),
      cell: (row) => <span className="text-sm">{summaryWords(row.diff["summary"], t, format.number)}</span>,
    },
    { id: "createdAt", header: t("columns.created"), cell: (row) => <When at={row.createdAt} /> },
  ];

  return (
    <div className="flex flex-col gap-5">
      {canImport ? (
        <Card padding="lg">
          <CardHeader>
            <CardTitle>{t("newTitle")}</CardTitle>
          </CardHeader>
          <p className="text-muted mb-4 text-sm">{t("newIntro")}</p>
          <div className="mb-4 flex flex-col gap-1.5">
            <p className="text-sm font-medium">{t("kind")}</p>
            <SegmentedControl
              label={t("kind")}
              value={kind}
              onValueChange={(value) => {
                setKind(value as Kind);
                setPreview(null);
              }}
              options={[
                { value: "master", label: t("kinds.master") },
                { value: "recipes", label: t("kinds.recipes") },
              ]}
            />
          </div>
          <FileDropzone
            accept=".json,application/json"
            maxBytes={20 * 1024 * 1024}
            disabled={upload.isPending}
            onFiles={([file]) => file && upload.mutate(file)}
            labels={{
              prompt: upload.isPending ? t("checking") : t("drop"),
              browse: t("browse"),
              tooLarge: (name) => t("tooLarge", { name }),
              wrongType: (name) => t("wrongType", { name }),
            }}
          />
        </Card>
      ) : null}

      {preview ? (
        <Card padding="lg">
          <CardHeader>
            <CardTitle>{t("previewTitle", { file: preview.fileName })}</CardTitle>
          </CardHeader>
          {preview.noop ? (
            <Callout tone="info" title={t(`noop.${preview.noopReason ?? "no_changes"}`)} />
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm">{summaryWords(preview.summary, t, format.number)}</p>
              <ChangeList
                title={t("direct", { count: preview.direct.length })}
                changes={preview.direct}
                words={words}
              />
              <ChangeList
                title={t("pending", { count: preview.pending.length })}
                hint={t("pendingHint")}
                changes={preview.pending}
                words={words}
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={() => setPreview(null)}>
                  {t("discard")}
                </Button>
                <Button onClick={() => setConfirming(true)}>{t("confirm")}</Button>
              </div>
            </div>
          )}
        </Card>
      ) : null}

      <ResourceList
        resource={importsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        empty={{ title: t("empty") }}
      />

      {preview ? (
        <ConfirmAction
          open={confirming}
          onOpenChange={setConfirming}
          title={t("confirmTitle")}
          description={t("confirmBody", {
            file: preview.fileName,
            direct: preview.direct.length,
            pending: preview.pending.length,
          })}
          confirmLabel={t("confirm")}
          onConfirm={async () => {
            try {
              const { data } = await adminBrowserApis().contract.POST("/v1/admin/style-imports", {
                body: { kind: preview.kind, fileId: preview.fileId, checksum: preview.checksum },
              });
              toast.success(data?.run?.status === "pending_approval" ? t("heldForApproval") : t("applied"));
              setPreview(null);
              setConfirming(false);
              void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "style_import") });
              void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "style") });
            } catch (error) {
              toast.error(problemMessage(error, t("confirmFailed")));
              throw error;
            }
          }}
        />
      ) : null}

      {open ? (
        <Dialog
          open
          onOpenChange={(next) => (next ? undefined : setOpen(null))}
          title={open.fileName}
          description={`${t(`kinds.${open.kind}`)} · ${t(`statuses.${open.status}`)}`}
          closeLabel={t("close")}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm">{summaryWords(open.diff["summary"], t, format.number)}</p>
            <ChangeList
              title={t("direct", { count: asChanges(open.diff["direct"]).length })}
              changes={asChanges(open.diff["direct"])}
              words={words}
            />
            <ChangeList
              title={t("pending", { count: asChanges(open.diff["pending"]).length })}
              changes={asChanges(open.diff["pending"])}
              words={words}
            />
            {open.approvalRequestId ? (
              <Link href={`/approvals/${open.approvalRequestId}`} className="text-primary text-sm hover:underline">
                {t("openApproval")}
              </Link>
            ) : null}
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

const asChanges = (value: unknown): Change[] => (Array.isArray(value) ? (value as Change[]) : []);

function summaryWords(summary: unknown, t: ReturnType<typeof useTranslations>, number: (n: number) => string): string {
  const counts = (summary ?? {}) as Record<string, number>;
  const parts = Object.entries(counts)
    .filter(([, n]) => typeof n === "number" && n > 0)
    .map(([key, n]) => (t.has(`summary.${key}`) ? t(`summary.${key}`, { count: number(n) }) : `${key} ${number(n)}`));
  return parts.join(" · ") || t("summary.none");
}

function ChangeList({
  title,
  hint,
  changes,
  words,
}: {
  title: string;
  hint?: string;
  changes: Change[];
  words: (change: Change) => string;
}) {
  if (changes.length === 0) return null;
  return (
    <section>
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint ? <p className="text-muted text-xs">{hint}</p> : null}
      <ul className="mt-2 flex max-h-72 flex-col gap-1 overflow-y-auto text-sm">
        {changes.map((change, index) => (
          <li key={`${String(change.code)}-${index}`}>
            <span className="font-mono">{String(change.code ?? "")}</span>{" "}
            <span className="text-muted">{words(change)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
