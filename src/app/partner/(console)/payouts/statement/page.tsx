import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";

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

  return (
    <PartnerPage title={t("title")} back={back} description={t("body")} wide>
      {/* The date box follows the browser (ค.ศ.); the พ.ศ. date under it is the one a Thai reader checks. */}
      <form action="/payouts/statement" className="flex flex-wrap items-end gap-3">
        <Field label={t("from")} hint={account.data ? format.date(account.data.from) : undefined}>
          <Input type="date" name="from" inputSize="lg" defaultValue={account.data?.from ?? query.from} />
        </Field>
        <Field label={t("to")} hint={account.data ? format.date(account.data.to) : undefined}>
          <Input type="date" name="to" inputSize="lg" defaultValue={account.data?.to ?? query.to} />
        </Field>
        <Button type="submit" size="xl" variant="secondary" iconStart="filter">
          {t("show")}
        </Button>
      </form>
      {account.data ? (
        <Card
          padding="none"
          className="overflow-x-auto"
          // Scrolls sideways on a phone: focusable, so a keyboard can scroll it too.
          tabIndex={0}
          role="region"
          aria-label={t("caption", { from: format.date(account.data.from), to: format.date(account.data.to) })}
        >
          <table className="w-full text-sm tabular-nums">
            <caption className="sr-only">
              {t("caption", { from: format.date(account.data.from), to: format.date(account.data.to) })}
            </caption>
            <thead className="bg-surface-subtle">
              <tr>
                <th scope="col" className="p-3 text-start font-medium">
                  {t("date")}
                </th>
                <th scope="col" className="p-3 text-start font-medium">
                  {t("reference")}
                </th>
                <th scope="col" className="p-3 text-end font-medium">
                  {t("credit")}
                </th>
                <th scope="col" className="p-3 text-end font-medium">
                  {t("debit")}
                </th>
                <th scope="col" className="p-3 text-end font-medium">
                  {t("balance")}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-border border-t">
                <td className="p-3" colSpan={4}>
                  {t("opening")}
                </td>
                <td className="p-3 text-end">{format.thb(account.data.opening)}</td>
              </tr>
              {account.data.entries.map((entry, index) => (
                <tr key={`${entry.reference}-${index}`} className="border-border border-t">
                  <td className="p-3 whitespace-nowrap">{format.date(entry.date)}</td>
                  <td className="p-3">
                    {entry.reference ? <span className="block font-mono">{entry.reference}</span> : null}
                    <span className="text-muted">{t(`kinds.${entry.kind}`)}</span>
                  </td>
                  <td className="p-3 text-end">{amount(entry.credit)}</td>
                  <td className="p-3 text-end">{amount(entry.debit)}</td>
                  <td className="p-3 text-end">{format.thb(entry.balance)}</td>
                </tr>
              ))}
              <tr className="border-border border-t font-semibold">
                <td className="p-3" colSpan={2}>
                  {t("closing")}
                </td>
                <td className="p-3 text-end">{format.thb(account.data.totalCredit)}</td>
                <td className="p-3 text-end">{format.thb(account.data.totalDebit)}</td>
                <td className="p-3 text-end">{format.thb(account.data.closing)}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      ) : (
        <PageError error={account.error} />
      )}
    </PartnerPage>
  );
}
