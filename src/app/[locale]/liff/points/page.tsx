import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { accountRequests } from "@/features/customer/account/api.server";
import { LiffSignIn } from "@/features/customer/liff/LiffSignIn";
import { liffCustomer } from "@/features/customer/liff/liff.server";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Stat } from "@/ui/components/Stat";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.points");
  return { title: t("title") };
}

/** Points in LINE (D-151): the balance and the latest movements; the rest on the site. */
export default async function Page() {
  if (!(await liffCustomer())) return <LiffSignIn />;
  const requests = await accountRequests();
  const [t, tLiff, format, points, entries] = await Promise.all([
    getTranslations("account.points"),
    getTranslations("liff.points"),
    getFormat(),
    requests.call("GET /v1/store/me/points"),
    requests.call("GET /v1/store/me/points/entries", { query: { perPage: 10 } }),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <div className="grid grid-cols-2 gap-3">
        <Stat
          label={t("available")}
          value={format.number(points.balance.available)}
          hint={format.thb(points.balance.availableBahtValue)}
        />
        <Stat label={tLiff("tier")} value={tLiff(`tiers.${points.tier.current}`)} />
      </div>
      <section aria-labelledby="liff-entries">
        <h2 id="liff-entries" className="font-semibold">
          {tLiff("latest")}
        </h2>
        <ul className="mt-2 flex flex-col">
          {entries.data.map((entry) => (
            <li key={entry.id} className="border-border flex justify-between gap-3 border-b py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate">{t(`types.${entry.entryType}`)}</span>
                <span className="text-muted block text-xs">{format.date(entry.createdAt)}</span>
              </span>
              <span className="tabular-nums">
                {t(entry.points > 0 ? "gain" : "loss", { points: format.number(entry.points) })}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <Link href="/account/points" className="text-primary text-sm underline underline-offset-4">
        {tLiff("more")}
      </Link>
    </div>
  );
}
