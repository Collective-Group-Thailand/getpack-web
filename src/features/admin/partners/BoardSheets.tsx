"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Pagination } from "@/ui/components/Pagination";
import { Select } from "@/ui/components/Select";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

import { FileField } from "../catalogue/FileField";
import { adminBrowserApis, FormDialog, FormError, QueryError, useCan } from "../console";
import { FileButton } from "../logistics/files";
import { useFactoryOptions } from "../production/factories";

type Sheet = Schemas["BoardStrengthSheetDto"];
type Draft = {
  factoryId: string;
  materialId: string;
  ectKnPerM: string;
  caliperMm: string;
  grammageGsm: string;
  testMethod: string;
  signedOn: string;
  effectiveFrom: string;
  dataSheetFileId: string;
  note: string;
};

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

/**
 * Partners' signed board data sheets (D-188, D-236): ECT, caliper and grammage per factory ×
 * corrugated board, each a new version from its date — nothing is edited. The Structure Advisor
 * reads the version in force, and never recommends a board that has none.
 */
export function BoardSheets() {
  const t = useTranslations("partners.boards");
  const tList = useTranslations("console.list");
  const format = useFormat();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const canManage = useCan("partners.manage");
  const factories = useFactoryOptions();
  const [factoryId, setFactoryId] = useState("");
  const [currentOnly, setCurrentOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const query = useQuery({
    queryKey: queryKeys.list("admin", "board_strength_sheet", { factoryId, currentOnly, page }),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/board-strength-sheets", {
          params: { query: { page, perPage: 25, currentOnly, ...(factoryId ? { factoryId } : {}) } },
        })
      ).data!,
  });
  const boards = useQuery({
    queryKey: queryKeys.list("admin", "catalog_materials", { kind: "corrugated_board", perPage: 100 }),
    enabled: draft !== null,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/catalog/materials", {
          params: { query: { kind: "corrugated_board", perPage: 100, sort: "code" } },
        })
      ).data!.data,
  });
  const name = (m: { nameTh: string; nameEn: string }) => (locale === "en" ? m.nameEn : m.nameTh);

  const columns: DataTableColumn<Sheet>[] = [
    {
      id: "factory",
      header: t("factory"),
      cell: (row) => <span className="font-mono text-sm">{row.factory.code}</span>,
    },
    {
      id: "board",
      header: t("board"),
      cell: (row) => (
        <div>
          <p>{name(row.material)}</p>
          <p className="text-muted font-mono text-xs">
            {row.material.code}
            {row.material.flute ? ` · ${row.material.flute}` : ""}
          </p>
        </div>
      ),
    },
    { id: "ect", header: t("ect"), numeric: true, cell: (row) => format.number(row.ectKnPerM) },
    { id: "caliper", header: t("caliper"), numeric: true, cell: (row) => format.number(row.caliperMm) },
    { id: "grammage", header: t("grammage"), numeric: true, cell: (row) => format.number(row.grammageGsm) },
    { id: "method", header: t("testMethod"), cell: (row) => <span className="text-sm">{row.testMethod}</span> },
    {
      id: "version",
      header: t("version"),
      cell: (row) => (
        <div className="text-sm">
          {t("versionNo", { no: row.versionNo })}{" "}
          {row.current ? (
            <Badge size="sm" tone="success">
              {t("current")}
            </Badge>
          ) : null}
          <p className="text-muted text-xs">
            {t("from")} <When at={row.effectiveFrom} absoluteOnly /> ·{" "}
            {t("signed", { date: format.date(row.signedOn) })}
          </p>
        </div>
      ),
    },
    {
      id: "file",
      header: t("sheet"),
      cell: (row) => (
        <FileButton size="sm" variant="ghost" iconStart="document" fileId={row.dataSheetFileId}>
          {t("open")}
        </FileButton>
      ),
    },
  ];
  const data = query.data;
  const num = (value: string) => Number(value);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        {factories.length ? (
          <Field label={t("factory")} className="w-64">
            <NativeSelect
              value={factoryId}
              onValueChange={(value) => {
                setFactoryId(value);
                setPage(1);
              }}
              options={[{ value: "", label: t("allFactories") }, ...factories]}
            />
          </Field>
        ) : null}
        <Switch
          label={t("currentOnly")}
          checked={currentOnly}
          onCheckedChange={(on) => {
            setCurrentOnly(on);
            setPage(1);
          }}
        />
        {canManage ? (
          <Button
            className="ms-auto"
            iconStart="plus"
            onClick={() =>
              setDraft({
                factoryId,
                materialId: "",
                ectKnPerM: "",
                caliperMm: "",
                grammageGsm: "",
                testMethod: "ISO 3037",
                signedOn: today(),
                effectiveFrom: "",
                dataSheetFileId: "",
                note: "",
              })
            }
          >
            {t("add")}
          </Button>
        ) : null}
      </div>
      {query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          caption={t("title")}
          columns={columns}
          rows={data?.data ?? []}
          getRowId={(row) => row.id}
          loading={query.isPending}
          empty={<EmptyState icon="layers" title={t("empty")} description={t("emptyHint")} />}
        />
      )}
      {data && data.meta.total > data.meta.perPage ? (
        <Pagination
          page={data.meta.page}
          perPage={data.meta.perPage}
          total={data.meta.total}
          onPageChange={setPage}
          labels={{
            nav: tList("pagination"),
            previous: tList("previous"),
            next: tList("next"),
            range: (from, to, total) => tList("range", { from, to, total }),
            pageOf: (current, pages) => tList("pageOf", { page: current, pages }),
            perPage: tList("perPage"),
          }}
        />
      ) : null}
      {draft ? (
        <FormDialog
          size="lg"
          title={t("addTitle")}
          description={t("addIntro")}
          submitLabel={t("save")}
          onClose={() => setDraft(null)}
          onSubmit={async () => {
            const values = [draft.ectKnPerM, draft.caliperMm, draft.grammageGsm].map(num);
            if (
              !draft.factoryId ||
              !draft.materialId ||
              values.some((v) => !(v > 0)) ||
              draft.testMethod.trim().length < 2
            )
              throw new FormError(t("incomplete"));
            if (!draft.dataSheetFileId) throw new FormError(t("fileRequired"));
            if (draft.effectiveFrom && draft.effectiveFrom < today()) throw new FormError(t("notPast"));
            await adminBrowserApis().contract.POST("/v1/admin/board-strength-sheets", {
              body: {
                factoryId: draft.factoryId,
                materialId: draft.materialId,
                ectKnPerM: values[0]!,
                caliperMm: values[1]!,
                grammageGsm: values[2]!,
                testMethod: draft.testMethod.trim(),
                signedOn: draft.signedOn,
                dataSheetFileId: draft.dataSheetFileId,
                ...(draft.effectiveFrom && draft.effectiveFrom > today()
                  ? { effectiveFrom: `${draft.effectiveFrom}T00:00:00+07:00` }
                  : {}),
                ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
              },
            });
            toast.success(t("saved"));
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "board_strength_sheet") });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("factory")} required>
              <Select
                value={draft.factoryId || undefined}
                placeholder={t("chooseFactory")}
                onValueChange={(value) => setDraft({ ...draft, factoryId: value })}
                options={factories}
              />
            </Field>
            <Field label={t("board")} required>
              <Select
                value={draft.materialId || undefined}
                placeholder={t("chooseBoard")}
                onValueChange={(value) => setDraft({ ...draft, materialId: value })}
                options={(boards.data ?? []).map((m) => ({ value: m.id, label: `${name(m)} (${m.code})` }))}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("ect")} required>
              <NumberInput
                unit="kN/m"
                min={0}
                step="0.01"
                value={draft.ectKnPerM}
                onChange={(e) => setDraft({ ...draft, ectKnPerM: e.target.value })}
              />
            </Field>
            <Field label={t("caliper")} required>
              <NumberInput
                unit="mm"
                min={0}
                step="0.01"
                value={draft.caliperMm}
                onChange={(e) => setDraft({ ...draft, caliperMm: e.target.value })}
              />
            </Field>
            <Field label={t("grammage")} required>
              <NumberInput
                unit="g/m²"
                min={0}
                value={draft.grammageGsm}
                onChange={(e) => setDraft({ ...draft, grammageGsm: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("testMethod")} required>
              <Input value={draft.testMethod} onChange={(e) => setDraft({ ...draft, testMethod: e.target.value })} />
            </Field>
            <Field label={t("signedOn")} required>
              <Input
                type="date"
                max={today()}
                value={draft.signedOn}
                onChange={(e) => setDraft({ ...draft, signedOn: e.target.value })}
              />
            </Field>
            <Field label={t("effectiveFrom")} hint={t("effectiveHint")}>
              <Input
                type="date"
                min={today()}
                value={draft.effectiveFrom}
                onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t("sheet")} hint={t("sheetHint")} required>
            <FileField
              purpose="document"
              value={draft.dataSheetFileId}
              onChange={(value) => setDraft({ ...draft, dataSheetFileId: String(value ?? "") })}
            />
          </Field>
          <Field label={t("note")}>
            <Textarea rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}
