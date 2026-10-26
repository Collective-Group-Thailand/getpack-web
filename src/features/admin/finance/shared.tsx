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
    case "vendor_invoice":
      return `/finance/payables/invoices/${source.id}`;
    case "bank_statement_line":
      return `/finance/banking/lines?line=${source.id}`;
    case "unidentified_receipt":
      return `/finance/banking/unidentified`;
    case "tax_report":
      return `/finance/tax/${source.id}`;
    case "fixed_asset":
      return `/finance/assets/${source.id}`;
    case "depreciation_run":
      return `/finance/assets/depreciation`;
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
      className="text-primary text-sm whitespace-nowrap tabular-nums hover:underline"
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
  if (!canRead || !user.data)
    return <span className="text-xs tabular-nums">{t("staffId", { id: id.slice(0, 8) })}</span>;
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
              className="text-primary text-sm whitespace-nowrap tabular-nums hover:underline"
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
          <span className="text-sm tabular-nums">{line.accountCode}</span> {line.accountName}
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

/** A bank account as the API lets it out: bank code and the last four digits only (PDPA, D-093). */
export function AccountNo({
  bank,
  last4,
  gl,
}: {
  bank?: string | null;
  last4: string | null | undefined;
  gl?: string | null;
}) {
  const t = useTranslations("finance.common");
  if (!last4) return <span className="text-muted">—</span>;
  return (
    <span className="text-sm whitespace-nowrap tabular-nums">
      {bank ? t("accountWithBank", { bank, last4 }) : t("accountLast4", { last4 })}
      {gl ? <span className="text-muted"> {t("accountGl", { gl })}</span> : null}
    </span>
  );
}
