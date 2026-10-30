import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { ActionPanel, PageError, PartnerDetail, PartnerPage } from "@/features/partner/frame";
import { PeriodPicker } from "@/features/partner/period";
import { ListToolbar } from "@/features/partner/rows";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";

type Props = { searchParams: Promise<{ from?: string; to?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerBilling.account"))("title") };
}

const isDay = (value: string | undefined) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);

/**
 * The factory's account with getpack between two dates (`partner.payables.statementOfAccount`): goods
 * received raise what getpack owes, payouts and deductions lower it, with the running balance and the
 * period's totals as the API gives them.
 */
export default async function StatementOfAccountPage({ searchParams }: Props) {
  const query = await searchParams;
  const t = await getTranslations("partnerBilling.account");
  const format = await getFormat();
  const context = await factoryContext();
  const { contract } = await partnerServerApis();
  const range = { ...(isDay(query.from) ? { from: query.from } : {}), ...(isDay(query.to) ? { to: query.to } : {}) };
  const account = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/statement-of-account", {
          params: { path: { factoryId: context.factoryId }, query: range },
        })
      ).data!,
  );
  const back = { href: "/payouts", label: t("back") };
  const amount = (value: string) => (/^-?0+(\.0+)?$/.test(value) ? "" : format.thb(value));

  const tPayouts = await getTranslations("partnerBilling.payouts");
  const tSales = await getTranslations("partnerSales.common");
  const data = account.data;
  const caption = data ? t("caption", { from: format.date(data.from), to: format.date(data.to) }) : t("title");

  return (
    <PartnerPage full title={t("title")} back={back} description={t("body")}>
      <ListToolbar>
        <PeriodPicker
          action="/payouts/statement"
          label={t("title")}
          fields={[
            { name: "from", label: t("from"), value: data?.from ?? query.from ?? "", type: "date" },
            { name: "to", label: t("to"), value: data?.to ?? query.to ?? "", type: "date" },
          ]}
          submit={t("show")}
        />
      </ListToolbar>
      {data ? (
        // The statement as a document on the left; where the account stands and where to go next on the right.
        <PartnerDetail
          aside={
            <ActionPanel id="soa-next" tone="neutral" title={tSales("nextSteps")}>
              <dl className="border-border grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1 border-b pb-3">
                <dt className="text-muted text-sm">{t("balance")}</dt>
                <dd className="text-end text-xl font-semibold tabular-nums">{format.thb(data.closing)}</dd>
                <dt className="text-muted text-sm">{t("opening")}</dt>
                <dd className="text-end tabular-nums">{format.thb(data.opening)}</dd>
                <dt className="text-muted text-sm">{t("credit")}</dt>
                <dd className="text-end tabular-nums">{format.thb(data.totalCredit)}</dd>
                <dt className="text-muted text-sm">{t("debit")}</dt>
                <dd className="text-end tabular-nums">{format.thb(data.totalDebit)}</dd>
              </dl>
              <div data-fill="row" className="flex flex-col gap-2">
                <Button asChild size="lg" variant="secondary" iconStart="calendar">
                  <Link href="/payouts/calendar">{tPayouts("calendarLink")}</Link>
                </Button>
                <Button asChild size="lg" variant="secondary" iconStart="coins">
                  <Link href="/payouts">{tPayouts("title")}</Link>
                </Button>
              </div>
            </ActionPanel>
          }
        >
          <section aria-label={caption} className="border-border bg-surface rounded-xl border">
            <header className="border-border border-b px-4 py-4 sm:px-5">
              <h2 className="text-lg font-semibold">{t("title")}</h2>
              <p className="text-muted text-sm tabular-nums">
                {format.date(data.from)} – {format.date(data.to)}
              </p>
            </header>
            {/* A desk reads it as a ledger table; a phone as one entry per row, the amounts on the right. */}
            <table className="hidden w-full tabular-nums md:table">
              <caption className="sr-only">{caption}</caption>
              <thead>
                <tr className="text-muted text-sm">
                  <th scope="col" className="px-5 pt-3 pb-2 text-start font-medium">
                    {t("date")}
                  </th>
                  <th scope="col" className="px-3 pt-3 pb-2 text-start font-medium">
                    {t("reference")}
                  </th>
                  <th scope="col" className="px-3 pt-3 pb-2 text-end font-medium">
                    {t("credit")}
                  </th>
                  <th scope="col" className="px-3 pt-3 pb-2 text-end font-medium">
                    {t("debit")}
                  </th>
                  <th scope="col" className="px-5 pt-3 pb-2 text-end font-medium">
                    {t("balance")}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-border border-t">
                  <th scope="row" colSpan={4} className="px-5 py-2.5 text-start font-medium">
                    {t("opening")}
                  </th>
                  <td className="px-5 py-2.5 text-end">{format.thb(data.opening)}</td>
                </tr>
                {data.entries.map((entry, index) => (
                  <tr key={`${entry.reference}-${index}`} className="border-border border-t">
                    <td className="px-5 py-2.5 whitespace-nowrap">{format.date(entry.date)}</td>
                    <td className="px-3 py-2.5">
                      {entry.reference ? <span className="block">{entry.reference}</span> : null}
                      <span className="text-muted text-sm">{t(`kinds.${entry.kind}`)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-end whitespace-nowrap">{amount(entry.credit)}</td>
                    <td className="px-3 py-2.5 text-end whitespace-nowrap">{amount(entry.debit)}</td>
                    <td className="px-5 py-2.5 text-end whitespace-nowrap">{format.thb(entry.balance)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <th scope="row" colSpan={2} className="px-5 pt-3 pb-4 text-start">
                    {t("closing")}
                  </th>
                  {[data.totalCredit, data.totalDebit].map((value, i) => (
                    <td key={i} className="px-3 pt-3 pb-4 text-end">
                      <span className="border-border-strong inline-block border-t pt-1 whitespace-nowrap">
                        {format.thb(value)}
                      </span>
                    </td>
                  ))}
                  <td className="px-5 pt-3 pb-4 text-end">
                    <span className="border-border-strong inline-block border-t border-b-[3px] border-double py-1 whitespace-nowrap">
                      {format.thb(data.closing)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <ol aria-label={caption} className="divide-border divide-y md:hidden">
              <li className="flex items-baseline justify-between gap-3 px-4 py-3">
                <span className="font-medium">{t("opening")}</span>
                <span className="tabular-nums">{format.thb(data.opening)}</span>
              </li>
              {data.entries.map((entry, index) => (
                <li
                  key={`${entry.reference}-${index}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block">{entry.reference ?? t(`kinds.${entry.kind}`)}</span>
                    <span className="text-muted text-sm">
                      {format.date(entry.date)}
                      {entry.reference ? ` · ${t(`kinds.${entry.kind}`)}` : ""}
                    </span>
                  </span>
                  <span className="flex flex-col items-end text-end tabular-nums">
                    <span className="font-medium whitespace-nowrap">
                      {amount(entry.credit) || (amount(entry.debit) ? `−${amount(entry.debit)}` : "")}
                    </span>
                    <span className="text-muted text-sm whitespace-nowrap">{format.thb(entry.balance)}</span>
                  </span>
                </li>
              ))}
              <li className="flex items-baseline justify-between gap-3 px-4 py-3 font-semibold">
                <span>{t("balance")}</span>
                <span className="tabular-nums">{format.thb(data.closing)}</span>
              </li>
            </ol>
          </section>
        </PartnerDetail>
      ) : (
        <PageError error={account.error} />
      )}
    </PartnerPage>
  );
}
