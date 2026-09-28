/**
 * The general ledger, read side (packio-api B5.1, published): journals with their lines, the
 * chart of accounts and the fiscal periods — what a document drills down into. Writing to the
 * ledger by hand (manual, recurring, reversing journals) and the rule viewer are F6.3's.
 */

import { matchesQuery, paginate, sortBy } from "../../support";
import { ACCOUNTS, fiscalYears, journals } from "./books";
import { finance, notFound } from "./support";

export const ledgerHandlers = [
  finance.get("/v1/admin/ledger/journals", "ledger.read", ({ query }) => {
    const rows = journals
      .filter((j) => !query.status || j.status === query.status)
      .filter((j) => !query.kind || j.kind === query.kind)
      .filter((j) => !query.periodId || j.periodId === query.periodId)
      .filter((j) => !query.sourceType || j.source?.type === query.sourceType)
      .filter((j) => !query.sourceId || j.source?.id === query.sourceId)
      .filter((j) => !query.domainEventId || j.domainEventId === query.domainEventId)
      .filter((j) => !query.accountCode || j.lines.some((line) => line.accountCode === query.accountCode))
      .filter((j) => !query.from || j.entryDate >= query.from)
      .filter((j) => !query.to || j.entryDate <= query.to)
      .filter((j) => matchesQuery(query.q, j.entryNo, j.jvNumber, j.description, j.source?.number, j.postingRule));
    return paginate(sortBy(rows, query.sort ?? "entryDate", query.order ?? "desc"), query);
  }),
  finance.get(
    "/v1/admin/ledger/journals/{journalId}",
    "ledger.read",
    ({ params }) => journals.find((journal) => journal.id === params.journalId) ?? notFound("รายการบัญชี"),
  ),
  finance.get("/v1/admin/ledger/accounts", "ledger.read", () => ACCOUNTS),
  finance.get("/v1/admin/ledger/fiscal-years", "ledger.read", () => fiscalYears),
];
