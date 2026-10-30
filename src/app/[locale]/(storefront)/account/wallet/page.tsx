import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { getMyCodes, getStoreCredit } from "@/features/customer/account/api.server";
import { CopyButton } from "@/features/customer/account/CopyButton";
import { PortalTable } from "@/features/customer/account/PortalTable";
import { customerStatusLabel } from "@/features/customer/account/status-label";
import { SummaryCards } from "@/features/customer/account/SummaryCards";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { PROMOTION_OFFER_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { cn } from "@/ui/lib/cn";

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
  const [t, tQuotes, tReferral, tStatus, format, credit, codes] = await Promise.all([
    getTranslations("account.wallet"),
    getTranslations("account.quotes"),
    getTranslations("account.referral"),
    getTranslations("status"),
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

  const usable = codes.filter((offer) => offer.status === "usable").length;

  return (
    <div>
      <AccountHeader title={t("title")} lede={t("intro")} />
      <SummaryCards
        className="mt-6"
        columns={2}
        items={[
          {
            key: "balance",
            label: t("balance"),
            value: format.thb(credit.balance),
            hint: t("creditHint"),
            icon: "wallet",
            highlight: true,
          },
          {
            key: "codes",
            label: t("codes"),
            value: format.number(codes.length),
            hint:
              usable > 0
                ? `${customerStatusLabel(tStatus, PROMOTION_OFFER_STATUS, "usable")} ${format.number(usable)}`
                : undefined,
            icon: "ticket",
          },
        ]}
      />

      <section aria-labelledby="wallet-codes" className="mt-10">
        <h2 id="wallet-codes" className="text-lg font-semibold">
          {t("codes")}
        </h2>
        <p className="text-muted mt-1 text-sm">{t("codesHint")}</p>
        {codes.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon="ticket"
            title={t("noCodes")}
            description={t("codesHint")}
            action={
              <Button asChild variant="secondary">
                <Link href="/products">{tQuotes("browse")}</Link>
              </Button>
            }
          />
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {codes.map((offer) => {
              const live = offer.status === "usable";
              const terms = [
                offer.description ?? benefit(offer),
                offer.conditions.minOrderValue
                  ? t("minOrder", { amount: format.thb(offer.conditions.minOrderValue) })
                  : null,
                offer.conditions.firstOrderOnly ? t("firstOrder") : null,
              ].filter(Boolean);
              return (
                <li
                  key={offer.code}
                  className={cn(
                    "rounded-card flex flex-col gap-3 border p-4",
                    live ? "border-border bg-surface" : "border-border bg-surface-subtle",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 font-semibold text-pretty">{offer.title}</p>
                    <StatusChip map={PROMOTION_OFFER_STATUS} value={offer.status} />
                  </div>
                  {terms.length > 0 ? <p className="text-muted text-sm">{terms.join(" · ")}</p> : null}
                  <div
                    className={cn(
                      "rounded-control flex flex-wrap items-center justify-between gap-2 border border-dashed px-3 py-2",
                      live ? "border-primary bg-primary-subtle text-primary-subtle-fg" : "border-border-strong",
                    )}
                  >
                    <span className="text-lg font-semibold tracking-wider tabular-nums">{offer.code}</span>
                    {live ? <CopyButton value={offer.code} label={tReferral("copyCode")} /> : null}
                  </div>
                  {offer.validUntil ? (
                    <p className="text-muted text-xs">{t("validUntil", { date: format.date(offer.validUntil) })}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {credit.entries.length > 0 ? (
        <section aria-labelledby="wallet-history" className="mt-10">
          <h2 id="wallet-history" className="text-lg font-semibold">
            {t("history")}
          </h2>
          <PortalTable
            className="mt-4"
            caption={t("history")}
            columns={[
              { key: "item", label: t("tableItem"), className: "md:w-1/2" },
              { key: "date", label: t("tableDate"), className: "md:whitespace-nowrap" },
              { key: "amount", label: t("tableAmount"), numeric: true, className: "md:whitespace-nowrap" },
            ]}
            rows={credit.entries.map((entry) => ({
              id: entry.id,
              phoneSubtitle:
                entry.orderCode || entry.docNumber ? (
                  <span className="tabular-nums">{[entry.orderCode, entry.docNumber].filter(Boolean).join(" · ")}</span>
                ) : null,
              cells: {
                item: (
                  <span className="block min-w-0">
                    <span className="block font-semibold">{t(`sources.${entry.source}`)}</span>
                    {entry.orderCode || entry.docNumber ? (
                      <span className="text-muted hidden text-xs font-normal tabular-nums md:block">
                        {[entry.orderCode, entry.docNumber].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                  </span>
                ),
                date: format.date(entry.createdAt),
                amount: <span className="font-semibold">{format.thb(entry.amount)}</span>,
              },
            }))}
          />
        </section>
      ) : null}
    </div>
  );
}
