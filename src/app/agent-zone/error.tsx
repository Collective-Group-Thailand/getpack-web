"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { reportError } from "@/lib/observability/report";
import { Button } from "@/ui/components/Button";
import { ErrorState } from "@/ui/components/ErrorState";

/**
 * Segment error boundary. `digest` is the id Next puts in the server log for this failure, so
 * it is shown as the support code (api-conventions §3).
 *
 * The error is reported here explicitly. `onRequestError` in `src/instrumentation.ts` catches
 * what fails on the server, but a component that throws while *rendering in the browser* never
 * reaches it — React hands it to this boundary instead, and without this call it would be
 * invisible.
 */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");

  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-16">
      <h1 className="sr-only">{t("errors.genericTitle")}</h1>
      <ErrorState
        title={t("errors.genericTitle")}
        description={t("errors.genericBody")}
        code={error.digest}
        codeLabels={{
          label: t("errors.reference"),
          copy: t("errors.copyReference"),
          copied: t("errors.referenceCopied"),
        }}
        action={
          <Button variant="secondary" onClick={reset}>
            {t("actions.retry")}
          </Button>
        }
      />
    </main>
  );
}
