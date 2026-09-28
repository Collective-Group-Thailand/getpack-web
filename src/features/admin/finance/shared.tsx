"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";

import { useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import { QueryError } from "../console/QueryError";

export type Journal = Schemas["JournalDto"];
export type JournalSource = NonNullable<Journal["source"]>;

/**
 * Where a record lives in the back office, so every number drills down: report → journal →
 * document → event → user (F6). A source type the UI has no screen for yet stays as text.
 */
export function sourceHref(source: { type: string; id: string } | null | undefined): string | null {
  if (!source) return null;
  switch (source.type) {
    case "customer_document":
      return `/finance/documents/${source.id}`;
    case "payment":
      return `/finance/payments/${source.id}`;
    case "refund":
      return `/finance/refunds?refund=${source.id}`;
    case "receivable_item":
      return `/finance/receivables?item=${source.id}`;
    default:
      return null;
  }
}

export const journalHref = (journalId: string) => `/finance/ledger/journals/${journalId}`;

/** A document number as a link to it — the one way a document is named in the workspace. */
export function DocumentLink({ document }: { document: { id: string; docNumber: string } | null | undefined }) {
  if (!document) return <span className="text-muted">—</span>;
  return (
    <Link
      href={`/finance/documents/${document.id}`}
      className="text-primary font-mono text-sm whitespace-nowrap hover:underline"
    >
      {document.docNumber}
    </Link>
  );
}

/**
 * A staff member named by id (journals carry the maker and checker as ids). Resolved through
 * the published user record when this person may read users; otherwise the short id, so the
 * trail is still followable by someone who can.
 */
export function StaffName({ id }: { id: string | null | undefined }) {
  const t = useTranslations("finance.common");
  const canRead = useCan("users.read");
  const user = useQuery({
    queryKey: queryKeys.detail("admin", "user", id ?? "none"),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/users/{userId}", { params: { path: { userId: id! } } })).data!,
    enabled: Boolean(id) && canRead,
    staleTime: 5 * 60_000,
  });
  if (!id) return <span className="text-muted">{t("system")}</span>;
  if (!canRead || !user.data) return <span className="font-mono text-xs">{t("staffId", { id: id.slice(0, 8) })}</span>;
  return (
    <Link href={`/users/${id}`} className="text-primary hover:underline">
      {user.data.displayName}
    </Link>
  );
}

/**
 * The journals a source record posted, with their lines — the step from a document to the
 * ledger. Each links to the journal itself (its event, rule version, maker and checker).
 */
export function SourceJournals({ sourceType, sourceId }: { sourceType: string; sourceId: string }) {
  const t = useTranslations("finance.journals");
  const format = useFormat();
  const canRead = useCan("ledger.read");
  const query = useQuery({
    queryKey: queryKeys.list("admin", "journal", { sourceType, sourceId }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/ledger/journals", {
          params: { query: { sourceType, sourceId, perPage: 50, sort: "entryDate", order: "asc" } },
        })
      ).data!,
    enabled: canRead,
  });
  if (!canRead) return <p className="text-muted text-sm">{t("noLedgerAccess")}</p>;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const lines = (query.data?.data ?? []).flatMap((journal) =>
    journal.lines.map((line) => ({ journal, line, id: `${journal.id}:${line.lineNo}` })),
  );
  const columns: DataTableColumn<(typeof lines)[number]>[] = [
    {
      id: "entry",
      header: t("entry"),
      cell: ({ journal, line }) =>
        line.lineNo === 1 ? (
          <div>
            <Link
              href={journalHref(journal.id)}
              className="text-primary font-mono text-sm whitespace-nowrap hover:underline"
            >
              {journal.entryNo ?? t("draft")}
            </Link>
            <p className="text-muted text-xs">
              {journal.postingRule
                ? t("ruleVersion", { rule: journal.postingRule, version: journal.postingRuleVersion ?? 1 })
                : t(`kinds.${journal.kind}`)}
              {journal.kind === "reversal" ? ` · ${t("kinds.reversal")}` : ""}
            </p>
          </div>
        ) : null,
    },
    {
      id: "account",
      header: t("account"),
      cell: ({ line }) => (
        <span>
          <span className="font-mono text-sm">{line.accountCode}</span> {line.accountName}
        </span>
      ),
    },
    {
      id: "debit",
      header: t("debit"),
      numeric: true,
      cell: ({ line }) => (line.debit === "0.00" ? "" : format.thb(line.debit)),
    },
    {
      id: "credit",
      header: t("credit"),
      numeric: true,
      cell: ({ line }) => (line.credit === "0.00" ? "" : format.thb(line.credit)),
    },
  ];
  return (
    <DataTable
      caption={t("caption")}
      columns={columns}
      rows={lines}
      getRowId={(row) => row.id}
      loading={query.isPending}
      density="compact"
      empty={<EmptyState icon="layers" title={t("none")} />}
    />
  );
}

/** A labelled amount in a summary grid — money is the API's string, formatted and nothing else. */
export function Figure({
  label,
  amount,
  tone,
  hint,
}: {
  label: React.ReactNode;
  amount: string | null | undefined;
  tone?: "danger" | "success" | "muted";
  hint?: React.ReactNode;
}) {
  const format = useFormat();
  return (
    <div className="border-border rounded-md border p-3">
      <dt className="text-muted text-xs">{label}</dt>
      <dd
        className={
          tone === "danger"
            ? "text-danger text-lg font-semibold tabular-nums"
            : tone === "success"
              ? "text-success text-lg font-semibold tabular-nums"
              : tone === "muted"
                ? "text-muted text-lg font-semibold tabular-nums"
                : "text-lg font-semibold tabular-nums"
        }
      >
        {format.thb(amount)}
      </dd>
      {hint ? <p className="text-muted mt-0.5 text-xs">{hint}</p> : null}
    </div>
  );
}

/** A problem's field errors keyed by path, for a hand-built form (a 422 with `errors[]`). */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  if (!isApiError(error)) return {};
  return Object.fromEntries(error.errors.map((item) => [item.path, item.message]));
}
