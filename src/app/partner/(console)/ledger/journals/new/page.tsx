import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { JournalForm } from "@/features/partner/ledger/LedgerForms";
import { accountOptions } from "@/features/partner/ledger/server";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerLedger.form"))("title") };
}

/** A manual journal (D-389), new or — with `?edit=` — a draft being changed. */
export default async function NewJournalPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const [t, tj, context] = await Promise.all([
    getTranslations("partnerLedger.form"),
    getTranslations("partnerLedger.journal"),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const back = { href: "/ledger/journals", label: tj("back") };
  if (!canAt(context, "factory_ledger.post"))
    return (
      <PartnerPage title={t("title")} back={back}>
        <EmptyState icon="lock" title={t("noPermission")} />
      </PartnerPage>
    );
  const [accounts, draft] = await Promise.all([
    accountOptions(contract, context.factoryId),
    edit
      ? attempt(async () => {
          const { data, response } = await contract.GET(
            "/v1/partner/factories/{factoryId}/erp/ledger/journals/{entryId}",
            { params: { path: { factoryId: context.factoryId, entryId: edit } } },
          );
          return { journal: data!, etag: response.headers.get("etag") };
        })
      : Promise.resolve(null),
  ]);
  if (draft && !draft.data)
    return (
      <PartnerPage title={t("editTitle")} back={back}>
        <PageError error={draft.error} />
      </PartnerPage>
    );
  return (
    <PartnerPage wide title={draft ? t("editTitle") : t("title")} description={t("body")} back={back}>
      <JournalForm
        accounts={accounts}
        {...(draft?.data ? { journal: draft.data.journal, etag: draft.data.etag } : {})}
      />
    </PartnerPage>
  );
}
