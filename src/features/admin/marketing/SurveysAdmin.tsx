"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import type { SurveyResults, SurveyTemplate } from "@/features/shared/loyalty-p2/types";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { BarValue } from "@/ui/components/charts";
import { DataTable } from "@/ui/components/DataTable";
import { DeskSection } from "@/ui/components/DeskPage";
import { EmptyState } from "@/ui/components/EmptyState";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage, QueryError, useCan } from "../console";
import { SurveyTemplateEditor } from "./SurveyTemplateEditor";

type Action = "publish" | "retire" | "new-version";

/**
 * `/marketing/surveys` (loyalty P2, D-491): the survey templates — trigger, version, status, response rate — with
 * publish, retire and new version (`admin.surveys.templateAction`; one published template per trigger, 409
 * `surveys.trigger_taken`), and a template's results: counts per option, rating averages, completion, and free text
 * with the customer masked (counts only below 10 responses, as the API sends). "สร้างชุดคำถาม" and a draft's "แก้ไข"
 * open the template editor (`createTemplate` / `updateTemplate`).
 */
export function SurveysAdmin() {
  const t = useTranslations("marketing.surveys");
  const format = useFormat();
  const en = useLocale() === "en";
  const queryClient = useQueryClient();
  const canManage = useCan("promotions.manage");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** The template in the editor: `"new"` for a new one, nothing when the editor is closed. */
  const [editing, setEditing] = useState<SurveyTemplate | "new" | null>(null);
  const listKey = queryKeys.list("admin", "survey_template", {});
  const templates = useQuery({
    queryKey: listKey,
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/surveys/templates", { params: { query: { perPage: 100 } } }))
        .data!.data,
  });
  const chosen = selected ?? templates.data?.find((row) => row.status === "published")?.id ?? null;
  const results = useQuery({
    queryKey: queryKeys.related("admin", "survey_template", chosen ?? "none", "results"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/surveys/templates/{templateId}/results", {
          params: { path: { templateId: chosen! } },
        })
      ).data!,
    enabled: Boolean(chosen),
  });

  const run = async (row: SurveyTemplate, action: Action) => {
    setBusy(`${row.id}:${action}`);
    try {
      await adminBrowserApis().contract.POST("/v1/admin/surveys/templates/{templateId}/actions/{action}", {
        params: { path: { templateId: row.id, action } },
      });
      toast.success(t(`actions.${action}.done`));
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "survey_template") });
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(null);
    }
  };

  if (templates.isError) return <QueryError error={templates.error} onRetry={() => void templates.refetch()} />;

  return (
    <div className="flex flex-col gap-6">
      <DeskSection
        title={t("templates")}
        description={t("templatesNote")}
        actions={
          canManage ? (
            <Button size="sm" iconStart="plus" onClick={() => setEditing("new")}>
              {t("editor.new")}
            </Button>
          ) : null
        }
      >
        <DataTable<SurveyTemplate>
          caption={t("templates")}
          rows={templates.data ?? []}
          loading={templates.isPending}
          getRowId={(row) => row.id}
          empty={<EmptyState icon="chat" title={t("empty")} />}
          columns={[
            {
              id: "title",
              header: t("columns.title"),
              cell: (row) => (
                <button
                  type="button"
                  className="text-start font-medium hover:underline"
                  aria-pressed={row.id === chosen}
                  onClick={() => setSelected(row.id)}
                >
                  {en ? row.title.en : row.title.th}
                  <span className="text-muted block text-xs font-normal tabular-nums">
                    {t("codeVersion", { code: row.code, version: row.version })}
                  </span>
                </button>
              ),
            },
            { id: "trigger", header: t("columns.trigger"), cell: (row) => t(`triggers.${row.trigger}`) },
            {
              id: "status",
              header: t("columns.status"),
              cell: (row) => (
                <Badge size="sm" tone={row.status === "published" ? "success" : "neutral"}>
                  {t(`statuses.${row.status}`)}
                </Badge>
              ),
            },
            { id: "questions", header: t("columns.questions"), numeric: true, cell: (row) => row.questions.length },
            {
              id: "responses",
              header: t("columns.responses"),
              numeric: true,
              cell: (row) => format.number(row.completed),
            },
            {
              id: "rate",
              header: t("columns.rate"),
              numeric: true,
              cell: (row) => (row.responseRatePct === null ? "—" : format.percent(row.responseRatePct)),
            },
            {
              id: "actions",
              header: <span className="sr-only">{t("columns.actions")}</span>,
              cell: (row) =>
                canManage ? (
                  <span className="flex justify-end gap-1.5">
                    {row.status === "draft" ? (
                      <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
                        {t("editor.edit")}
                      </Button>
                    ) : null}
                    {(row.status === "draft"
                      ? (["publish"] as const)
                      : row.status === "published"
                        ? (["retire", "new-version"] as const)
                        : (["new-version"] as const)
                    ).map((action) => (
                      <Button
                        key={action}
                        size="sm"
                        variant={action === "publish" ? "primary" : "ghost"}
                        loading={busy === `${row.id}:${action}`}
                        onClick={() => void run(row, action)}
                      >
                        {t(`actions.${action}.label`)}
                      </Button>
                    ))}
                  </span>
                ) : null,
            },
          ]}
        />
      </DeskSection>

      {editing ? (
        <SurveyTemplateEditor
          key={editing === "new" ? "new" : editing.id}
          open
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            toast.success(t(editing === "new" ? "editor.created" : "editor.saved"));
            setEditing(null);
            setSelected(saved.id);
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "survey_template") });
          }}
        />
      ) : null}

      {chosen ? (
        <DeskSection title={t("results.title")} description={t("results.note")}>
          {results.isError ? <QueryError error={results.error} onRetry={() => void results.refetch()} /> : null}
          {results.data ? <Results data={results.data} /> : results.isPending ? <Skeleton className="h-64" /> : null}
        </DeskSection>
      ) : null}
    </div>
  );
}

function Results({ data }: { data: SurveyResults }) {
  const t = useTranslations("marketing.surveys.results");
  const format = useFormat();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-sm tabular-nums">
        {t("completion", {
          completed: format.number(data.responses),
          opened: format.number(data.opened),
          pct: data.completionRatePct === null ? "—" : format.percent(data.completionRatePct),
        })}
        {data.countsOnly ? ` · ${t("countsOnly")}` : null}
      </p>
      <ol className="m-0 grid list-none gap-4 p-0 lg:grid-cols-2">
        {data.questions.map((question, at) => {
          const max = Math.max(0, ...question.counts.map((option) => option.count));
          return (
            <li key={question.key} className="border-border bg-surface rounded-panel border p-4">
              <p className="flex items-baseline gap-2.5">
                <span className="text-subtle text-[0.8125rem] tabular-nums">{at + 1}</span>
                <span className="font-semibold">{question.label}</span>
              </p>
              <p className="text-muted ms-5 mt-0.5 text-[0.8125rem]">{t("answered", { count: question.answered })}</p>
              <div className="ms-5 mt-3">
                {question.kind === "rating" ? (
                  <p className="text-2xl font-semibold tabular-nums">
                    {question.average ?? "—"}
                    <span className="text-muted ms-1.5 text-sm font-normal">{t("outOf5")}</span>
                  </p>
                ) : question.kind === "text" ? (
                  question.texts.length ? (
                    <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-sm">
                      {question.texts.map((entry, index) => (
                        <li key={index} className="border-border border-s-2 ps-3">
                          <p>{entry.text}</p>
                          <p className="text-muted text-xs tabular-nums">
                            {[entry.customer, entry.orderCode].filter(Boolean).join(" · ")}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted text-sm">{t("noText")}</p>
                  )
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
                    {question.counts.map((option) => (
                      <li key={option.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                        <span className="min-w-0 truncate">{option.label}</span>
                        <BarValue value={option.count} max={max}>
                          {format.number(option.count)}
                        </BarValue>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
