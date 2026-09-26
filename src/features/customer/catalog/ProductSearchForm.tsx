import { getTranslations } from "next-intl/server";

import { Button } from "@/ui/components/Button";
import { Input } from "@/ui/components/Input";

/**
 * A plain GET form: works before JavaScript, keeps the query in the URL (shareable, crawlable),
 * and costs nothing on a page with a 150 KB budget.
 */
export async function ProductSearchForm({ action, q }: { action: string; q?: string }) {
  const t = await getTranslations("catalog");
  return (
    <form action={action} method="get" role="search" className="flex gap-2">
      <label htmlFor="catalogue-q" className="sr-only">
        {t("list.searchLabel")}
      </label>
      <Input
        id="catalogue-q"
        name="q"
        type="search"
        defaultValue={q}
        placeholder={t("list.searchPlaceholder")}
        className="min-w-0 flex-1"
      />
      <Button type="submit" variant="secondary">
        {t("list.searchSubmit")}
      </Button>
    </form>
  );
}
