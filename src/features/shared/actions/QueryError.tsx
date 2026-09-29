"use client";

import { useTranslations } from "next-intl";

import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { ErrorState } from "@/ui/components/ErrorState";

import { useProblemCopy } from "./useProblemCopy";

/**
 * Why a screen could not load, and what to do about it (design-system.md §4 "errors: inline,
 * specific, recoverable … error codes shown small for support").
 *
 * A `403` and a `404` are answers, not failures — they get their own wording and no retry,
 * because retrying cannot change them. Everything else offers a retry and the request id, under
 * this app's title for the problem code when it has one (U-F0.1) and the API's detail beneath.
 */
export function QueryError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useTranslations("common.errors");
  const tCommon = useTranslations("common");
  const api = isApiError(error) ? error : null;
  const copy = useProblemCopy()(error);

  if (api?.status === 403)
    return <ErrorState title={t("forbiddenTitle")} description={t("forbiddenBody")} code={api.requestId} />;
  if (api?.status === 404)
    return <ErrorState title={t("itemNotFoundTitle")} description={t("itemNotFoundBody")} code={api.requestId} />;

  return (
    <ErrorState
      title={copy?.title ?? t("loadFailedTitle")}
      description={(copy ? copy.detail : api?.detail) ?? t("loadFailedBody")}
      code={api?.requestId || undefined}
      action={
        onRetry ? (
          <Button variant="secondary" iconStart="refresh" onClick={onRetry}>
            {tCommon("actions.retry")}
          </Button>
        ) : undefined
      }
    />
  );
}

/** A failed mutation, as a toast-sized sentence: the API's own localised `detail`. */
export function problemMessage(error: unknown, fallback: string): string {
  return isApiError(error) && error.detail ? error.detail : fallback;
}
