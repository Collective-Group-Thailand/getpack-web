"use client";

import { useEffect } from "react";

import { reportError } from "@/lib/observability/report";
import { fontClassNames } from "@/ui/fonts";
import "./globals.css";

/**
 * The last resort: a failure in a root layout itself, which replaces the whole document —
 * including the next-intl provider and the theme.
 *
 * The copy is therefore bilingual rather than translated: there is no message bundle to
 * read at this point, and the locale is exactly what has just been lost. It is short on
 * purpose; anything richer would need the tree that failed.
 *
 * This is the one file exempt from the hard-coded-string rule, for that reason. The rule is
 * disabled for the whole component rather than per line so the exemption is visible at the
 * top and cannot quietly spread to a second file.
 */
/* eslint-disable react/jsx-no-literals -- no message bundle exists here; see above. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // The only report that will ever be made for this failure: a root layout threw, so there is
  // no segment boundary above and nothing else left running.
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <html lang="th" className={fontClassNames}>
      <body>
        <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4 text-center">
          <h1 className="text-xl font-semibold">เกิดข้อผิดพลาด · Something went wrong</h1>
          <p className="text-muted text-sm">ลองโหลดหน้านี้อีกครั้ง · Please try loading this page again.</p>
          {error.digest ? <p className="text-muted font-mono text-xs select-all">{error.digest}</p> : null}
          <p>
            <button
              type="button"
              onClick={reset}
              className="border-border rounded-lg border px-4 py-2 text-sm font-medium"
            >
              ลองอีกครั้ง · Try again
            </button>
          </p>
        </main>
      </body>
    </html>
  );
}
