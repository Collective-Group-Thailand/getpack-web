import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

/**
 * A storefront destination the shell links to but F3 has not built yet.
 *
 * These exist because the alternative is worse in two ways. A header whose links 404 is not a
 * finished shell — and Next's 404 response to an RSC *prefetch* carries no `content-length`,
 * so the browser holds the connection open until keep-alive expires. Every link in the
 * viewport that pointed at a missing route left a socket hanging, which is what made
 * `networkidle` unreachable in the e2e suite and would have shown up as a slow page to a real
 * visitor.
 *
 * Each of these is replaced by the real screen in F3, not extended.
 */
export async function ComingSoon({ titleKey }: { titleKey: string }) {
  const t = await getTranslations("storefront");
  const tCommon = await getTranslations("common");

  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      {/* One h1 per page, and it names the destination rather than saying "coming soon". */}
      <h1 className="sr-only">{t(titleKey)}</h1>
      <EmptyState
        icon="box"
        title={t(titleKey)}
        description={t("comingSoon.body")}
        action={
          <Button asChild>
            <Link href="/">{tCommon("nav.home")}</Link>
          </Button>
        }
      />
    </div>
  );
}
