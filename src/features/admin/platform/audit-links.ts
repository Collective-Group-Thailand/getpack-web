/** The console page of an audited record, where one exists — the log links its entity instead of printing an id. */
const PAGES: Record<string, (id: string) => string> = {
  user: (id) => `/users/${id}`,
  order: (id) => `/orders/${id}`,
  setting: (id) => `/settings/${id}`,
  factory: (id) => `/partners/${id}`,
  company: (id) => `/companies/${id}`,
  approval_request: (id) => `/approvals/${id}`,
  shipment: (id) => `/shipments/${id}`,
  sample: (id) => `/samples/${id}`,
  sales_agent: (id) => `/agents/${id}`,
  sales_agent_plan: (id) => `/agents/plans/${id}`,
  sales_agent_statement: (id) => `/agents/statements/${id}`,
  payout_run: (id) => `/finance/payouts/${id}`,
  journal_entry: (id) => `/finance/ledger/journals/${id}`,
  tax_report: (id) => `/finance/tax/${id}`,
  vendor: (id) => `/finance/payables/vendors/${id}`,
  vendor_invoice: (id) => `/finance/payables/invoices/${id}`,
  customer_document: (id) => `/finance/documents/${id}`,
};

export function auditRecordHref(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  return PAGES[type]?.(id) ?? null;
}

export type AuditLine = { key: string; before?: unknown; after?: unknown; value?: unknown };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * What an entry recorded, as lines to read: a `before`/`after` pair becomes one change per field (or one line when
 * they are plain values), everything else a field and its value. Nothing is dropped — the raw record stays one
 * click away.
 */
export function auditLines(data: unknown): AuditLine[] {
  if (!isRecord(data)) return data === null || data === undefined ? [] : [{ key: "", value: data }];
  const lines: AuditLine[] = [];
  const { before, after, ...rest } = data;
  if ("before" in data || "after" in data) {
    if (isRecord(before) || isRecord(after)) {
      const b = isRecord(before) ? before : {};
      const a = isRecord(after) ? after : {};
      for (const key of new Set([...Object.keys(b), ...Object.keys(a)]))
        if (JSON.stringify(b[key]) !== JSON.stringify(a[key])) lines.push({ key, before: b[key], after: a[key] });
    } else lines.push({ key: "", before, after });
  }
  for (const [key, value] of Object.entries(rest)) lines.push({ key, value });
  return lines;
}
