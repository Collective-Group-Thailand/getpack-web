"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { JOURNAL_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { PageHeader } from "@/ui/components/PageHeader";

import { useActor, useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import { Section } from "../console/FormDialog";
import { QueryError } from "../console/QueryError";
import { ResourceList } from "../console/ResourceList";
import type { InitialPage } from "../console/resource";
import { StatusChip } from "../console/StatusChip";
import { JournalActions } from "./ledger";
import { JOURNAL_KINDS, JOURNAL_STATUSES, journalsList } from "./resources";
import { journalHref, sourceHref, StaffName, type Journal } from "./shared";

type Line = Journal["lines"][number];

/**
 * One journal entry (accounting-design §1): immutable once posted, balanced, and carrying where it
 * came from — the source document, the domain event, the posting rule and its version, the maker
 * and the checker. A correction is a reversing entry linked both ways, never an edit.
 */
export function JournalDetail({ journalId }: { journalId: string }) {
  const t = useTranslations("finance.journals");
  const format = useFormat();
  const actor = useActor();
  const query = useQuery({
    queryKey: queryKeys.detail("admin", "journal", journalId),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/ledger/journals/{journalId}", {
          params: { path: { journalId } },
        })
      ).data!,
  });
  const periods = useQuery({
    queryKey: queryKeys.list("admin", "fiscal-year"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/ledger/fiscal-years")).data!,
    staleTime: 10 * 60_000,
  });

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const journal = query.data;
  if (!journal) return null;
  const period = periods.data
    ?.flatMap((year) => year.periods.map((p) => ({ ...p, year: year.label })))
    .find((p) => p.id === journal.periodId);
  const source = journal.source;
  const href = sourceHref(source);

  const columns: DataTableColumn<Line>[] = [
    { id: "lineNo", header: "#", numeric: true, cell: (row) => row.lineNo },
    {
      id: "account",
      header: t("account"),
      cell: (row) => (
        <Link href={`/finance/ledger/journals?accountCode=${row.accountCode}`} className="hover:underline">
          <span className="font-mono text-sm">{row.accountCode}</span> {row.accountName}
        </Link>
      ),
    },
    { id: "description", header: t("lineDescription"), cell: (row) => row.description ?? "" },
    {
      id: "dimensions",
      header: t("dimensions"),
      cell: (row) => (
        <span className="text-muted flex flex-wrap gap-1 text-xs">
          {Object.entries(row.dimensions).map(([dimension, value]) => (
            <Badge key={dimension} tone="neutral" size="sm">
              {t(`dimensionNames.${dimension}`)}: {String(value).slice(0, 8)}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      id: "tax",
      header: t("tax"),
      cell: (row) =>
        row.taxCode ? (
          <span className="text-xs">
            {t(`taxCodes.${row.taxCode}`)}
            {row.taxBaseAmount ? (
              <span className="text-muted block">{t("taxBase", { amount: format.thb(row.taxBaseAmount) })}</span>
            ) : null}
          </span>
        ) : null,
    },
    {
      id: "debit",
      header: t("debit"),
      numeric: true,
      cell: (row) => (row.debit === "0.00" ? "" : format.thb(row.debit)),
    },
    {
      id: "credit",
      header: t("credit"),
      numeric: true,
      cell: (row) => (row.credit === "0.00" ? "" : format.thb(row.credit)),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[
              { label: t("journals"), href: "/finance/ledger/journals" },
              { label: journal.entryNo ?? t("draft") },
            ]}
          />
        }
        title={t("title", { number: journal.entryNo ?? journal.jvNumber ?? t("draft") })}
        meta={
          <>
            <StatusChip map={JOURNAL_STATUS} value={journal.status} size="md" />
            <span className="text-muted text-sm">{t(`kinds.${journal.kind}`)}</span>
          </>
        }
        description={journal.description}
        actions={<JournalActions journal={journal} isMaker={journal.createdBy === actor.id} />}
      />

      {journal.status === "pending_approval" ? (
        <Callout tone="warning" title={t("waitingTitle")}>
          {journal.createdBy === actor.id ? t("waitingMaker") : t("waitingBody")}{" "}
          {journal.approvalRequestId ? (
            <Link href={`/approvals/${journal.approvalRequestId}`} className="text-primary hover:underline">
              {t("openApproval")}
            </Link>
          ) : null}
        </Callout>
      ) : null}
      {journal.status === "rejected" ? (
        <Callout tone="danger" title={t("rejectedTitle")}>
          {journal.rejectionReason ?? t("rejectedBody")}
        </Callout>
      ) : null}
      {journal.autoReverseOn && journal.status !== "rejected" ? (
        <Callout tone="info" title={t("autoReverseTitle")}>
          {t("autoReverseBody", { date: format.date(journal.autoReverseOn) })}
        </Callout>
      ) : null}

      {journal.reversedById ? (
        <Callout tone="warning" title={t("reversedTitle")}>
          <Link href={journalHref(journal.reversedById)} className="text-primary hover:underline">
            {t("openReversal")}
          </Link>
        </Callout>
      ) : null}

      <Section title={t("trail")} description={t("trailNote")}>
        <DescriptionList
          columns={3}
          items={[
            {
              term: t("source"),
              description: source ? (
                href ? (
                  <Link href={href} className="text-primary font-mono hover:underline">
                    {source.number ?? source.id.slice(0, 8)}
                  </Link>
                ) : (
                  <span className="font-mono">{source.number ?? source.id.slice(0, 8)}</span>
                )
              ) : (
                t("manual")
              ),
            },
            { term: t("sourceType"), description: source ? t(`sourceTypes.${source.type}`) : "—" },
            {
              term: t("event"),
              description: journal.domainEventId ? (
                <Link
                  href={`/outbox?q=${journal.domainEventId}`}
                  className="text-primary font-mono text-xs hover:underline"
                >
                  {journal.domainEventId}
                </Link>
              ) : (
                "—"
              ),
            },
            {
              term: t("rule"),
              description: journal.postingRule
                ? t("ruleVersion", { rule: journal.postingRule, version: journal.postingRuleVersion ?? 1 })
                : "—",
            },
            { term: t("documentDate"), description: format.date(journal.documentDate) },
            { term: t("entryDate"), description: format.date(journal.entryDate) },
            {
              term: t("period"),
              description: period ? t("periodName", { year: period.year, no: period.periodNo }) : "—",
            },
            { term: t("maker"), description: <StaffName id={journal.createdBy} /> },
            { term: t("checker"), description: journal.approvedBy ? <StaffName id={journal.approvedBy} /> : "—" },
            { term: t("postedAt"), description: <When at={journal.postedAt} absoluteOnly /> },
            {
              term: t("reverses"),
              description: journal.reversesId ? (
                <Link href={journalHref(journal.reversesId)} className="text-primary hover:underline">
                  {t("openOriginal")}
                </Link>
              ) : (
                "—"
              ),
            },
            {
              term: t("approval"),
              description: journal.approvalRequestId ? (
                <Link href={`/approvals/${journal.approvalRequestId}`} className="text-primary hover:underline">
                  {t("openApproval")}
                </Link>
              ) : (
                "—"
              ),
            },
          ]}
        />
      </Section>

      <Section title={t("lines")}>
        <DataTable
          caption={t("lines")}
          columns={columns}
          rows={journal.lines}
          getRowId={(row) => String(row.lineNo)}
          density="compact"
        />
        <dl className="ms-auto mt-3 grid max-w-xs grid-cols-2 gap-x-6 text-sm">
          <dt className="text-muted">{t("totalDebit")}</dt>
          <dd className="text-end font-semibold tabular-nums">{format.thb(journal.totalDebit)}</dd>
          <dt className="text-muted">{t("totalCredit")}</dt>
          <dd className="text-end font-semibold tabular-nums">{format.thb(journal.totalCredit)}</dd>
        </dl>
      </Section>
    </div>
  );
}

/**
 * Journals (accounting-design §1), filtered by account, kind, status or date through the URL —
 * where an account on a report or a line on a document lands, and where a manual entry starts.
 */
export function JournalsList({ initial }: { initial: InitialPage<Journal> | null }) {
  const t = useTranslations("finance.journals");
  const format = useFormat();
  const canManage = useCan("ledger.journals.manage");
  const columns: DataTableColumn<Journal>[] = [
    {
      id: "entryNo",
      header: t("entry"),
      cell: (row) => (
        <div>
          <Link href={journalHref(row.id)} className="text-primary font-mono text-sm whitespace-nowrap hover:underline">
            {row.entryNo ?? row.jvNumber ?? t("draft")}
          </Link>
          <p className="text-muted text-xs">
            {row.postingRule
              ? t("ruleVersion", { rule: row.postingRule, version: row.postingRuleVersion ?? 1 })
              : t(`kinds.${row.kind}`)}
          </p>
        </div>
      ),
    },
    { id: "entryDate", header: t("entryDate"), sortable: true, cell: (row) => format.date(row.entryDate) },
    {
      id: "description",
      header: t("lineDescription"),
      cell: (row) => <span className="line-clamp-2">{row.description}</span>,
    },
    {
      id: "source",
      header: t("source"),
      cell: (row) => {
        const href = sourceHref(row.source);
        const label = row.source ? (row.source.number ?? row.source.id.slice(0, 8)) : t("manual");
        return href ? (
          <Link href={href} className="text-primary font-mono text-sm whitespace-nowrap hover:underline">
            {label}
          </Link>
        ) : (
          <span className="font-mono text-sm">{label}</span>
        );
      },
    },
    {
      id: "status",
      header: t("status"),
      cell: (row) => <StatusChip map={JOURNAL_STATUS} value={row.status} />,
    },
    { id: "totalDebit", header: t("amount"), numeric: true, cell: (row) => format.thb(row.totalDebit) },
  ];
  return (
    <ResourceList
      resource={journalsList}
      columns={columns}
      caption={t("journals")}
      initial={initial}
      searchLabel={t("search")}
      exportable
      toolbarEnd={
        canManage ? (
          <Button asChild size="sm" iconStart="plus">
            <Link href="/finance/ledger/journals/new">{t("newManual")}</Link>
          </Button>
        ) : null
      }
      filters={[
        { id: "accountCode", label: t("account"), kind: "text", placeholder: "1210" },
        {
          id: "kind",
          label: t("kind"),
          kind: "select",
          options: JOURNAL_KINDS.map((value) => ({ value, label: t(`kinds.${value}`) })),
        },
        {
          id: "status",
          label: t("status"),
          kind: "select",
          options: JOURNAL_STATUSES.map((value) => ({ value, label: t(`statuses.${value}`) })),
        },
        { id: "from", label: t("from"), kind: "date" },
        { id: "to", label: t("to"), kind: "date" },
      ]}
      empty={{ title: t("none") }}
    />
  );
}
