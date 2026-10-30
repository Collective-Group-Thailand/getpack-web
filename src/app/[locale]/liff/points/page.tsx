import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getPoints, getPointsEntries } from "@/features/customer/account/api.server";
import { SummaryCards } from "@/features/customer/account/SummaryCards";
import { LiffHeader } from "@/features/customer/liff/LiffHeader";
import { LiffSignIn } from "@/features/customer/liff/LiffSignIn";
import { liffCustomer } from "@/features/customer/liff/liff.server";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.points");
  return { title: t("title") };
}

/** Points in LINE (D-151): the balance and the latest movements; the rest on the site. */
export default async function Page() {
  if (!(await liffCustomer())) return <LiffSignIn />;
  const [t, tLiff, format, points, entries] = await Promise.all([
    getTranslations("account.points"),
    getTranslations("liff.points"),
    getFormat(),
    getPoints(),
    getPointsEntries(10),
  ]);
  // Project D: the balance and the tier as summary cards (the balance on the tint), the latest movements as one
  // card of rows, and the full history on the web as a button.
  return (
    <div className="flex flex-col gap-4">
      <LiffHeader title={t("title")} />
      <SummaryCards
        columns={2}
        wideHighlight={false}
        items={[
          {
            key: "available",
            label: t("available"),
            value: format.number(points.availablePoints),
            hint: format.thb(points.availableValue),
            icon: "star",
            highlight: true,
          },
          { key: "tier", label: tLiff("tier"), value: tLiff(`tiers.${points.tier}`), icon: "gift" },
        ]}
      />
      <section aria-labelledby="liff-entries" className="border-border bg-surface rounded-card border p-4">
        <h2 id="liff-entries" className="font-semibold">
          {tLiff("latest")}
        </h2>
        <ul className="divide-border mt-2 flex flex-col divide-y">
          {entries.map((entry) => (
            <li key={entry.id} className="flex min-h-14 items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{t(`types.${entry.entryType}`)}</span>
                <span className="text-muted block text-xs">{format.date(entry.createdAt)}</span>
              </span>
              <span className={cn("font-semibold tabular-nums", entry.points > 0 && "text-primary")}>
                {t(entry.points > 0 ? "gain" : "loss", { points: format.number(entry.points) })}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <Button asChild variant="secondary" size="lg" iconEnd="external">
        <Link href="/account/points">{tLiff("more")}</Link>
      </Button>
    </div>
  );
}
