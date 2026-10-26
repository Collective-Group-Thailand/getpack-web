"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { classifyError, RETRY_DELAYS_MS } from "@/lib/api/transient";
import { reportError } from "@/lib/observability/report";
import { Button } from "@/ui/components/Button";
import { ErrorState } from "@/ui/components/ErrorState";

import { NextStep } from "./NextStep";

/**
 * Retries are counted per address in the module, not in the component: a boundary that throws
 * again is mounted anew, and a counter in its state would start over and loop for ever. A count
 * older than a minute is a different outage.
 */
const attempts = new Map<string, { count: number; at: number }>();
const FORGET_AFTER_MS = 60_000;

function attemptsFor(key: string, now: number): number {
  const entry = attempts.get(key);
  return entry && now - entry.at < FORGET_AFTER_MS ? entry.count : 0;
}

/**
 * The customer zone's segment error boundary. A temporary failure (throttled, the service behind
 * the API down, no network) reads "ระบบขัดข้องชั่วคราว", retries by itself a few times with growing
 * pauses, and always shows the reference code support finds the failure by (api-conventions §3).
 * Anything else keeps the generic words and a manual retry.
 */
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  const { kind, reference } = classifyError(error);
  const key = typeof window === "undefined" ? "" : window.location.pathname;
  const [tried, setTried] = useState(() => attemptsFor(key, Date.now()));
  const max = RETRY_DELAYS_MS.length;
  const retrying = kind === "transient" && tried < max;

  useEffect(() => {
    reportError(error);
  }, [error]);

  useEffect(() => {
    if (!retrying) return;
    const timer = setTimeout(() => {
      attempts.set(key, { count: tried + 1, at: Date.now() });
      setTried(tried + 1);
      reset();
    }, RETRY_DELAYS_MS[tried]);
    return () => clearTimeout(timer);
  }, [retrying, tried, key, reset]);

  const temporary = kind === "transient";
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-16">
      <h1 className="sr-only">{temporary ? t("errors.temporaryTitle") : t("errors.genericTitle")}</h1>
      <ErrorState
        title={temporary ? t("errors.temporaryTitle") : t("errors.genericTitle")}
        description={
          temporary
            ? retrying
              ? t("errors.temporaryRetrying", { attempt: tried + 1, max })
              : t("errors.temporaryBody")
            : t("errors.genericBody")
        }
        code={reference}
        codeLabels={{
          label: t("errors.reference"),
          copy: t("errors.copyReference"),
          copied: t("errors.referenceCopied"),
        }}
        action={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                attempts.delete(key);
                setTried(0);
                reset();
              }}
            >
              {t("actions.retry")}
            </Button>
            {/* Never a dead end (U5.1 §3): someone can still help, with the code above. */}
            <NextStep to="chat" variant="ghost" />
          </>
        }
      />
    </main>
  );
}
