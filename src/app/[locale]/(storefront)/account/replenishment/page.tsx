import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { NextStep } from "@/features/customer/shell/NextStep";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { listSuggestions } from "@/features/customer/repeat/api.server";
import { SuggestionCard } from "@/features/customer/repeat/SuggestionCard";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.replenishment");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** When to order again (U2.F5, D-288): one suggestion per product, with its reasoning. */
export default async function Page() {
  await requireCustomer();
  const [t, tTabs, suggestions] = await Promise.all([
    getTranslations("account.replenishment"),
    getTranslations("account.tabs"),
    listSuggestions(),
  ]);
  return (
    <div>
      <AccountHeader
        title={t("title")}
        lede={t("intro")}
        actions={
          <Button asChild variant="secondary" iconStart="calendar">
            <Link href="/account/call-offs">{tTabs("callOffs")}</Link>
          </Button>
        }
      />
      {suggestions.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon="calendar"
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={<NextStep to="orders" />}
        />
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {suggestions.map((suggestion) => (
            <SuggestionCard key={suggestion.id} suggestion={suggestion} />
          ))}
        </ul>
      )}
    </div>
  );
}
