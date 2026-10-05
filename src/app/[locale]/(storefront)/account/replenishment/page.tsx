import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { listSuggestions } from "@/features/customer/repeat/api.server";
import { SuggestionCard } from "@/features/customer/repeat/SuggestionCard";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.replenishment");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** When to order again (U2.F5, D-288): one suggestion per product, with its reasoning. */
export default async function Page() {
  await requireCustomer();
  const [t, suggestions] = await Promise.all([getTranslations("account.replenishment"), listSuggestions()]);
  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted mt-1">{t("intro")}</p>
      {suggestions.length === 0 ? (
        <EmptyState className="mt-8" icon="calendar" title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {suggestions.map((suggestion) => (
            <SuggestionCard key={suggestion.id} suggestion={suggestion} />
          ))}
        </ul>
      )}
      <p className="text-muted mt-6 text-xs">{t("remindNote")}</p>
    </div>
  );
}
