import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getStoreCredit } from "@/features/customer/account/api.server";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getFormat } from "@/features/shared/format/server";
import { Stat } from "@/ui/components/Stat";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.wallet");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Store credit and its history (F3 3.4, D-080).
 *
 * CONTRACT-GAP store.wallet — the contract has no list of the promotion codes a customer holds,
 * so the page shows store credit only; a code is still entered in the cart.
 */
export default async function Page() {
  await requireCustomer();
  const [t, format, credit] = await Promise.all([getTranslations("account.wallet"), getFormat(), getStoreCredit()]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted mt-1">{t("intro")}</p>
      </div>
      <section aria-labelledby="wallet-credit">
        <h2 id="wallet-credit" className="text-lg font-semibold">
          {t("credit")}
        </h2>
        <Stat
          className="mt-4 max-w-xs"
          label={t("balance")}
          value={format.thb(credit.balance)}
          hint={t("creditHint")}
        />
        {credit.entries.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {credit.entries.map((entry) => (
              <li
                key={entry.id}
                className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{t(`sources.${entry.source}`)}</p>
                  <p className="text-muted text-xs">
                    {format.date(entry.createdAt)}
                    {entry.orderCode ? (
                      <>
                        {" · "}
                        <span className="font-mono">{entry.orderCode}</span>
                      </>
                    ) : null}
                    {entry.docNumber ? (
                      <>
                        {" · "}
                        <span className="font-mono">{entry.docNumber}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <span className="tabular-nums">{format.thb(entry.amount)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
