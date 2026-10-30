import { getTranslations } from "next-intl/server";

import { isApiError } from "@/lib/api/problem";
import { EmptyState } from "@/ui/components/EmptyState";
import { ErrorState } from "@/ui/components/ErrorState";

/**
 * Why a server-rendered read failed. A `403` and a `404` are answers (another factory's id is a
 * 404 — D-044), not failures, so they get their own words; anything else names the request id.
 */
export async function PageError({ error }: { error: unknown }) {
  const t = await getTranslations("common.errors");
  const api = isApiError(error) ? error : null;
  // Not an alarm: a record that is not there (or not this factory's) is said calmly, in grey, not red.
  if (api?.status === 403)
    return <EmptyState icon="lock" title={t("forbiddenTitle")} description={t("forbiddenBody")} />;
  if (api?.status === 404)
    return <EmptyState icon="search" title={t("itemNotFoundTitle")} description={t("itemNotFoundBody")} />;
  return (
    <ErrorState
      title={t("loadFailedTitle")}
      description={api?.detail || t("loadFailedBody")}
      code={api?.requestId || undefined}
      codeLabels={{ label: t("reference"), copy: t("copyReference"), copied: t("referenceCopied") }}
    />
  );
}
