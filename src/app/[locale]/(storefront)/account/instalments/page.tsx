import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { INSTALMENT_STATUS } from "@/domain/status";
import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { customerStatusLabel } from "@/features/customer/account/status-label";
import { SummaryCards, type SummaryItem } from "@/features/customer/account/SummaryCards";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { InstalmentList } from "@/features/customer/checkout/InstalmentList";
import { getFormat } from "@/features/shared/format/server";
import { serverApi } from "@/lib/api/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("instalments");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * The instalment centre (F3 3.3). Project B2: the account header, then the figures on top — the next
 * instalment to pay (its open amount as the API sends it, and when it falls due) and how many instalments
 * stand at each status — then the list itself.
 */
export default async function Page() {
  await requireCustomer();
  const [t, tStatus, format, instalments] = await Promise.all([
    getTranslations("instalments"),
    getTranslations("status"),
    getFormat(),
    (await serverApi("customer"))
      .GET("/v1/store/instalments", { params: { query: { perPage: 100 } } })
      .then(({ data }) => data!.data),
  ]);

  // The payable instalment that falls due first (one with no date — paid at a step — after the dated ones).
  const next = instalments
    .filter((instalment) => instalment.payable)
    .sort((a, b) => (a.dueAt ?? "￿").localeCompare(b.dueAt ?? "￿"))[0];
  const count = (status: (typeof instalments)[number]["status"]) =>
    instalments.filter((instalment) => instalment.status === status).length;
  const overdue = count("overdue");
  const due = count("due");

  const items: SummaryItem[] = [
    ...(next
      ? [
          {
            key: "next",
            label: t("nextDue"),
            value: format.thb(next.openAmount),
            hint: [
              next.dueAt ? t("dueBy", { date: format.date(next.dueAt) }) : t(`trigger.${next.dueTrigger}`),
              next.orders[0]?.orderCode ?? next.groupCode,
            ].join(" · "),
            icon: "wallet" as const,
            highlight: true,
          },
        ]
      : []),
    {
      key: "overdue",
      label: customerStatusLabel(tStatus, INSTALMENT_STATUS, "overdue"),
      value: format.number(overdue),
      icon: "warning",
      tone: overdue > 0 ? "danger" : "neutral",
    },
    {
      key: "due",
      label: customerStatusLabel(tStatus, INSTALMENT_STATUS, "due"),
      value: format.number(due),
      icon: "clock",
      tone: due > 0 ? "warning" : "neutral",
    },
    {
      key: "paid",
      label: customerStatusLabel(tStatus, INSTALMENT_STATUS, "paid"),
      value: format.number(count("paid")),
      icon: "check",
    },
  ];

  return (
    <div>
      <AccountHeader title={t("title")} lede={t("intro")} />
      {instalments.length > 0 ? <SummaryCards className="mt-6" items={items} /> : null}
      <InstalmentList instalments={instalments} />
    </div>
  );
}
