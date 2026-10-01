import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getMyCodes, getStoreCredit } from "@/features/customer/account/api.server";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { PROMOTION_OFFER_STATUS } from "@/domain/status";
import { Stat } from "@/ui/components/Stat";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.wallet");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Store credit and its history (F3 3.4, D-080), and the promotion codes the customer holds
 * (`store.promotions.listMine`, D-053) with what each gives in its own terms and whether it can
 * be used now. A code is still entered in the cart; spending credit at checkout is U2.F (D-196).
 */
export default async function Page() {
  await requireCustomer();
  const [t, format, credit, codes] = await Promise.all([
    getTranslations("account.wallet"),
    getFormat(),
    getStoreCredit(),
    getMyCodes(),
  ]);
  const benefit = (offer: (typeof codes)[number]) => {
    const cap = offer.benefit.maxAmount ? t("benefitCap", { amount: format.thb(offer.benefit.maxAmount) }) : "";
    if (offer.benefit.pct) return `${t("benefitPercent", { pct: format.percent(offer.benefit.pct) })}${cap}`;
    if (offer.benefit.amount) return `${t("benefitFixed", { amount: format.thb(offer.benefit.amount) })}${cap}`;
    return null;
  };

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
      <section aria-labelledby="wallet-codes">
        <h2 id="wallet-codes" className="text-lg font-semibold">
          {t("codes")}
        </h2>
        <p className="text-muted mt-1 text-sm">{t("codesHint")}</p>
        {codes.length === 0 ? (
          <p className="text-muted mt-4 text-sm">{t("noCodes")}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {codes.map((offer) => (
              <li key={offer.code} className="border-border flex flex-col gap-1 rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-semibold">{offer.code}</span>
                  <StatusChip map={PROMOTION_OFFER_STATUS} value={offer.status} />
                </div>
                <p className="font-medium">{offer.title}</p>
                <p className="text-muted">
                  {[
                    offer.description ?? benefit(offer),
                    offer.conditions.minOrderValue
                      ? t("minOrder", { amount: format.thb(offer.conditions.minOrderValue) })
                      : null,
                    offer.conditions.firstOrderOnly ? t("firstOrder") : null,
                    offer.validUntil ? t("validUntil", { date: format.date(offer.validUntil) }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
