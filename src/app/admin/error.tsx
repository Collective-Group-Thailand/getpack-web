"use client";

import { useTranslations } from "next-intl";
import { Button, ErrorState } from "@/ui";

/**
 * Segment error boundary. `digest` is the id Next puts in the server log for this failure,
 * so it is shown as the support code — the same slot the API's `requestId` fills once the
 * clients land in F1 Deliverable 1.2 (api-conventions.md §3).
 */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-16">
      <h1 className="sr-only">{t("errors.genericTitle")}</h1>
      <ErrorState
        title={t("errors.genericTitle")}
        description={t("errors.genericBody")}
        code={error.digest}
        action={
          <Button variant="secondary" onClick={reset}>
            {t("actions.retry")}
          </Button>
        }
      />
    </main>
  );
}
