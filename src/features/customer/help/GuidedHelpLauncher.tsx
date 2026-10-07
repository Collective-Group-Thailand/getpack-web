"use client";

import { useTranslations } from "next-intl";
import { lazy, Suspense, useState } from "react";

import { usePathname } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";

const Sheet = lazy(() => import("@/ui/components/Sheet").then((module) => ({ default: module.Sheet })));
const GuidedHelp = lazy(() => import("./GuidedHelp").then((module) => ({ default: module.GuidedHelp })));

/** Where the launcher stays out of the way: tasks with their own dock or a single job to finish. */
const HIDDEN = [
  /^\/configure\//,
  /^\/cart/,
  /^\/checkout/,
  /^\/account/,
  /^\/track\//,
  /^\/liff/,
  /^\/help\/chat/,
  /^\/business\/(?!$)/,
];

/**
 * The guided help widget's launcher (F3 3.7). Only the button ships with the page; the sheet and
 * its questions load on the first click, so the storefront's budget pays for one button.
 */
export function GuidedHelpLauncher() {
  const t = useTranslations("help.guided");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (HIDDEN.some((pattern) => pattern.test(pathname))) return null;

  return (
    <>
      <Button
        iconStart="help"
        size="sm"
        className="fixed end-4 bottom-20 z-30 md:bottom-6"
        aria-haspopup="dialog"
        aria-label={t("launcher")}
        onClick={() => {
          setLoaded(true);
          setOpen(true);
        }}
      >
        <span className="hidden sm:inline">{t("launcher")}</span>
      </Button>
      {loaded ? (
        <Suspense fallback={null}>
          <Sheet open={open} onOpenChange={setOpen} title={t("title")} description={t("intro")} closeLabel={t("close")}>
            <GuidedHelp headingLevel="h3" />
          </Sheet>
        </Suspense>
      ) : null}
    </>
  );
}
