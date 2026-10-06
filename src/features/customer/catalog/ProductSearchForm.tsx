import { getTranslations } from "next-intl/server";

import { LiveSearch } from "./LiveSearch";

/**
 * A plain GET form around a search-as-you-type field: it works before JavaScript, keeps the query
 * in the URL (shareable, crawlable), and needs no separate "ค้นหา" button (UX audit).
 */
export async function ProductSearchForm({ action, q }: { action: string; q?: string }) {
  const t = await getTranslations("catalog");
  return (
    <form action={action} method="get" role="search">
      <LiveSearch
        action={action}
        q={q}
        label={t("list.searchLabel")}
        placeholder={t("list.searchPlaceholder")}
        clearLabel={t("list.clear")}
      />
    </form>
  );
}
