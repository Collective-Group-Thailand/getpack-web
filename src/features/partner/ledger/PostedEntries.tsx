import { getTranslations } from "next-intl/server";

import { JOURNAL_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PartnerSection } from "@/features/partner/frame";
import { Row, RowList } from "@/features/partner/rows";
import { StatusChip } from "@/features/partner/status";
import { getFormat } from "@/features/shared/format/server";

/**
 * The factory's ledger entries a document made (D-388): shown on the document for whoever reads the books, so an
 * accountant goes from an invoice, a receipt, a payment or a Packio statement straight to its journal — and sees a
 * reversal when the document was cancelled. Nothing is shown before the ledger has an entry for it.
 */
export async function PostedEntries({ sourceId }: { sourceId: string }) {
  const context = await factoryContext();
  if (!canAt(context, "factory_ledger.read")) return null;
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/journals", {
          params: { path: { factoryId: context.factoryId }, query: { sourceId, perPage: 10 } },
        })
      ).data!.data,
  );
  const entries = read.data ?? [];
  if (!entries.length) return null;
  const [t, format] = await Promise.all([getTranslations("partnerLedger.posted"), getFormat()]);
  return (
    <PartnerSection title={t("title")} description={t("body")}>
      <RowList label={t("title")}>
        {entries.map((entry) => (
          <Row
            key={entry.id}
            href={`/ledger/journals/${entry.id}`}
            icon="list-ordered"
            title={
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{entry.entryNo ?? t("draft")}</span>
                <StatusChip map={JOURNAL_STATUS} value={entry.status} />
                {entry.ruleKey ? <span className="text-muted text-xs">{t("rule", { key: entry.ruleKey })}</span> : null}
              </span>
            }
            meta={`${format.date(entry.documentDate)} · ${entry.description}`}
            aside={format.thb(entry.totalDebit)}
          />
        ))}
      </RowList>
    </PartnerSection>
  );
}
