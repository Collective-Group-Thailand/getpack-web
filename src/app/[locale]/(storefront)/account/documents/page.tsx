import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { DOCUMENT_CORRECTION_STATUS, ETAX_STATUS } from "@/domain/status";
import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { TabBar } from "@/features/customer/account/AccountTabs";
import { PortalTable } from "@/features/customer/account/PortalTable";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import {
  CancelledCopyLink,
  RequestCorrection,
  WithdrawCorrection,
} from "@/features/customer/documents/DocumentActions";
import { DocumentLink } from "@/features/customer/orders/DocumentLink";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Link } from "@/i18n/navigation";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";

type DocType = Schemas["CustomerDocumentType"];
const DOC_TYPES = ["iv", "tr", "rc", "cn", "dn"] as const satisfies readonly DocType[];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PER_PAGE = 25;

type Search = { docType?: string; from?: string; to?: string; q?: string; page?: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.documents");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * The customer's documents centre (D-430, D-431): every tax invoice, receipt and credit or debit note issued to
 * them, by kind and date, with its PDF, whether it went out by e-Tax by Email, and — on a tax invoice whose buyer
 * is wrong — a request to correct it. A cancelled document keeps its copy stamped "ยกเลิก" and points to its
 * replacement.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const [, search] = await Promise.all([requireCustomer(), searchParams]);
  const [t, tTypes, format] = await Promise.all([
    getTranslations("account.documents"),
    getTranslations("myOrders.documents.types"),
    getFormat(),
  ]);
  const docType = DOC_TYPES.find((type) => type === search.docType);
  const from = search.from && DATE.test(search.from) ? search.from : undefined;
  const to = search.to && DATE.test(search.to) ? search.to : undefined;
  const q = search.q?.trim().slice(0, 200) || undefined;
  const page = Math.max(1, Number.parseInt(search.page ?? "1", 10) || 1);
  const { data } = await (
    await serverApi("customer")
  ).GET("/v1/store/documents", {
    params: {
      query: {
        page,
        perPage: PER_PAGE,
        ...(docType ? { docType } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(q ? { q } : {}),
      },
    },
  });
  const documents = data!.data;
  const pages = Math.max(1, Math.ceil(data!.meta.total / PER_PAGE));
  const filtered = Boolean(docType || from || to || q);
  const pageHref = (next: number) => {
    const params = new URLSearchParams();
    if (docType) params.set("docType", docType);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (q) params.set("q", q);
    params.set("page", String(next));
    return `/account/documents?${params.toString()}`;
  };

  return (
    <div>
      <AccountHeader
        title={t("title")}
        lede={t("intro")}
        actions={
          <Button asChild variant="secondary" iconStart="box">
            <Link href="/account/orders">{t("toOrders")}</Link>
          </Button>
        }
      />

      {/* Project B2: one toolbar card — the kinds of document as tabs on top, the date range and number search
          under a divider — over the table. */}
      <div className="border-border bg-surface rounded-card mt-6 border">
        <div className="p-3">
          <TabBar
            label={t("filters.type")}
            items={[
              { key: "all", href: "/account/documents", label: t("filters.allTypes"), current: !docType },
              ...DOC_TYPES.map((type) => ({
                key: type,
                href: `/account/documents?docType=${type}`,
                label: tTypes(type),
                current: docType === type,
              })),
            ]}
          />
        </div>
        <form
          method="get"
          action=""
          className="border-border grid gap-3 border-t p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr_auto]"
        >
          {docType ? <input type="hidden" name="docType" value={docType} /> : null}
          <Field label={t("filters.from")}>
            <Input type="date" name="from" defaultValue={from ?? ""} />
          </Field>
          <Field label={t("filters.to")}>
            <Input type="date" name="to" defaultValue={to ?? ""} />
          </Field>
          <Field label={t("filters.q")}>
            <Input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder={t("filters.qPlaceholder")}
              maxLength={200}
            />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" iconStart="search">
              {t("filters.apply")}
            </Button>
            {filtered ? (
              <Button asChild variant="ghost">
                <Link href="/account/documents">{t("filters.clear")}</Link>
              </Button>
            ) : null}
          </div>
        </form>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon="document"
          title={filtered ? t("emptyFiltered") : t("emptyTitle")}
          description={filtered ? undefined : t("emptyBody")}
          action={
            <Button asChild variant="secondary">
              <Link href={filtered ? "/account/documents" : "/account/orders"}>
                {filtered ? t("filters.clear") : t("toOrders")}
              </Link>
            </Button>
          }
        />
      ) : (
        <PortalTable
          className="mt-4"
          caption={t("table.caption")}
          columns={[
            { key: "document", label: t("table.document"), className: "md:min-w-[13rem]" },
            { key: "date", label: t("table.date"), className: "md:whitespace-nowrap" },
            { key: "amount", label: t("table.amount"), numeric: true, className: "md:whitespace-nowrap" },
            { key: "status", label: t("table.status") },
            { key: "actions", label: t("table.actions"), srOnly: true, className: "text-end" },
          ]}
          rows={documents.map((doc) => {
            const voided = doc.status === "void";
            const pending = doc.correction?.status === "pending" ? doc.correction : null;
            const correctable =
              !voided && doc.isTaxInvoice && (doc.docType === "iv" || doc.docType === "tr") && !pending;
            return {
              id: doc.id,
              phoneSubtitle: <span className="tabular-nums">{doc.docNumber}</span>,
              cells: {
                document: (
                  <span className="block min-w-0">
                    <span className="block font-semibold">{tTypes(doc.docType)}</span>
                    <span className="text-muted hidden text-xs font-normal tabular-nums md:block">{doc.docNumber}</span>
                    {doc.orderCode && doc.orderId ? (
                      <Link
                        href={`/account/orders/${doc.orderId}`}
                        className="text-primary block text-xs font-normal underline"
                      >
                        {t("order", { code: doc.orderCode })}
                      </Link>
                    ) : null}
                    {doc.replaces ? (
                      <span className="text-muted block text-xs font-normal">
                        {t("replaces", { no: doc.replaces.docNumber })}
                      </span>
                    ) : null}
                    {doc.replacedBy ? (
                      <span className="block text-xs font-normal">
                        {t("replacedBy", { no: doc.replacedBy.docNumber })}
                      </span>
                    ) : null}
                  </span>
                ),
                date: format.date(doc.documentDate),
                amount: <span className="font-semibold">{format.thb(doc.grossAmount)}</span>,
                status: (
                  <span className="flex flex-wrap gap-1.5">
                    {voided ? (
                      <Badge tone="danger" size="sm">
                        {t("voided")}
                      </Badge>
                    ) : null}
                    {doc.eTaxStatus !== "not_applicable" ? (
                      <StatusChip map={ETAX_STATUS} value={doc.eTaxStatus} />
                    ) : null}
                    {doc.correction && doc.correction.status !== "withdrawn" ? (
                      <StatusChip map={DOCUMENT_CORRECTION_STATUS} value={doc.correction.status} />
                    ) : null}
                    {doc.correction?.status === "rejected" && doc.correction.decisionNote ? (
                      <span className="text-muted w-full text-xs">{doc.correction.decisionNote}</span>
                    ) : null}
                  </span>
                ),
                actions: (
                  <span className="flex flex-wrap justify-end gap-2">
                    {doc.pdfReady ? <DocumentLink documentId={doc.id} number={doc.docNumber} /> : null}
                    {voided && doc.cancelledPdfReady ? (
                      <CancelledCopyLink documentId={doc.id} number={doc.docNumber} />
                    ) : null}
                    {correctable ? (
                      <RequestCorrection documentId={doc.id} number={doc.docNumber} buyer={doc.buyer} />
                    ) : null}
                    {pending ? <WithdrawCorrection requestId={pending.id} number={doc.docNumber} /> : null}
                  </span>
                ),
              },
            };
          })}
        />
      )}
      {pages > 1 ? (
        <nav aria-label={t("pagination")} className="mt-6 flex items-center justify-between gap-3">
          {page > 1 ? (
            <Button asChild variant="secondary" size="sm" iconStart="chevron-left">
              <Link href={pageHref(page - 1)}>{t("previous")}</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-muted text-sm">{t("pageOf", { page, pages })}</span>
          {page < pages ? (
            <Button asChild variant="secondary" size="sm" iconEnd="chevron-right">
              <Link href={pageHref(page + 1)}>{t("next")}</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
