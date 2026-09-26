import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { accountRequests } from "@/features/customer/account/api.server";
import { CopyButton } from "@/features/customer/account/CopyButton";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { Stat } from "@/ui/components/Stat";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.wallet");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Promotion codes held and store credit (F3 3.4, D-053, D-080). */
export default async function Page() {
  await requireCustomer();
  const [t, format, wallet] = await Promise.all([
    getTranslations("account.wallet"),
    getFormat(),
    (await accountRequests()).call("GET /v1/store/me/wallet"),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted mt-1">{t("intro")}</p>
      </div>
      <section aria-labelledby="wallet-codes">
        <h2 id="wallet-codes" className="text-lg font-semibold">
          {t("codes")}
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {wallet.promotions.map((promotion, index) => (
            <li key={`${promotion.code}-${index}`} className="border-border flex flex-col gap-2 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{promotion.title}</p>
                <Badge tone={promotion.status === "available" ? "success" : "neutral"}>
                  {t(`statuses.${promotion.status}`)}
                </Badge>
              </div>
              <p className="text-sm">{promotion.benefit}</p>
              {promotion.conditions ? <p className="text-muted text-xs">{promotion.conditions}</p> : null}
              {promotion.validUntil ? (
                <p className="text-muted text-xs">{t("validUntil", { date: format.date(promotion.validUntil) })}</p>
              ) : null}
              {promotion.code && promotion.status === "available" ? (
                <div className="mt-auto flex items-center gap-2">
                  <span className="font-mono">{promotion.code}</span>
                  <CopyButton value={promotion.code} label={t("copy")} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-muted mt-2 text-xs">{t("codesNote")}</p>
      </section>
      <section aria-labelledby="wallet-credit">
        <h2 id="wallet-credit" className="text-lg font-semibold">
          {t("credit")}
        </h2>
        <Stat
          className="mt-4 max-w-xs"
          label={t("balance")}
          value={format.thb(wallet.storeCredit.balance)}
          hint={t("creditHint")}
        />
        {wallet.storeCredit.entries.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {wallet.storeCredit.entries.map((entry) => (
              <li
                key={entry.id}
                className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{t(`kinds.${entry.kind}`)}</p>
                  <p className="text-muted text-xs">
                    {format.date(entry.createdAt)}
                    {entry.order ? (
                      <>
                        {" · "}
                        <Link
                          href={`/account/orders/${entry.order.id}`}
                          className="text-primary underline underline-offset-4"
                        >
                          {entry.order.orderCode}
                        </Link>
                      </>
                    ) : null}
                  </p>
                  {entry.note ? <p className="text-muted text-xs">{entry.note}</p> : null}
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
