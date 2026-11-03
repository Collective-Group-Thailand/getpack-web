"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { AGENT_QUOTE_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { QueueTabs, ResourceList, StatusChip, type InitialPage } from "../console";
import { Figure } from "./figure";
import { salesQuotesList, type SalesQuote } from "./resources";

const STATUSES = ["sent", "opened", "accepted", "expired", "withdrawn"] as const;

/**
 * Sales quotes (D-469): the quotes the desk's reps (and, for a manager, freelance agents) sent from their leads —
 * product, quantity, the customer's price with VAT, whether the customer opened it, and the deal mark. A row leads to
 * its lead, where the discount request and its approval live.
 */
export function SalesQuotes({ initial }: { initial: InitialPage<SalesQuote> | null }) {
  const t = useTranslations("sales.quotes");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const columns: DataTableColumn<SalesQuote>[] = [
    {
      id: "quote",
      header: t("columns.quote"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <Link href={`/sales/leads/${row.lead.id}`} className="text-primary truncate font-medium hover:underline">
            {row.quote.summary.product?.nameTh ?? row.quote.quoteCode}
          </Link>
          <span className="text-muted text-xs tabular-nums">{row.quote.quoteCode}</span>
        </div>
      ),
    },
    {
      id: "lead",
      header: t("columns.lead"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate">{row.lead.contactName}</span>
          {row.lead.organisationName ? (
            <span className="text-muted truncate text-xs">{row.lead.organisationName}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "quantity",
      header: t("columns.quantity"),
      cell: (row) => <span className="tabular-nums">{format.number(row.quote.options[0]?.quantity ?? 0)}</span>,
    },
    {
      id: "amount",
      header: t("columns.amount"),
      cell: (row) => (
        <Figure
          name="quoteGross"
          source={{ label: row.quote.quoteCode ?? t("columns.quote"), href: `/sales/leads/${row.lead.id}` }}
          asOf={row.sentAt}
          className="font-medium tabular-nums"
        >
          {format.thb(row.quote.options[0]?.grossAmount)}
        </Figure>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => (
        <div className="flex flex-col items-start gap-1">
          <StatusChip map={AGENT_QUOTE_STATUS} value={row.status} />
          {row.dealRegistration?.status === "registered" ? (
            <span className="text-success-subtle-fg text-xs font-medium">{t("deal")}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "sentAt",
      header: t("columns.sent"),
      cell: (row) => (
        <div className="flex flex-col text-sm">
          <When at={row.sentAt} />
          {row.openedAt ? (
            <span className="text-muted text-xs">
              {t("opened", { at: format.dateTime(row.openedAt, { style: "dayMonth" }) })}
            </span>
          ) : null}
        </div>
      ),
    },
  ];
  return (
    <ResourceList
      views={
        <QueueTabs
          countFrom={salesQuotesList}
          hideEmpty
          label={t("statusesLabel")}
          param="status"
          tabs={[
            { value: null, label: t("all") },
            ...STATUSES.map((status) => ({ value: status, label: tStatus(AGENT_QUOTE_STATUS[status].labelKey) })),
          ]}
        />
      }
      resource={salesQuotesList}
      columns={columns}
      caption={t("title")}
      initial={initial}
      searchLabel={t("search")}
      savedViews={false}
      rowHref={(row) => `/sales/leads/${row.lead.id}`}
      empty={{
        title: t("empty"),
        description: t("emptyHint"),
        action: (
          <Button asChild variant="secondary" iconStart="users">
            <Link href="/sales/pipeline">{t("toPipeline")}</Link>
          </Button>
        ),
      }}
    />
  );
}
