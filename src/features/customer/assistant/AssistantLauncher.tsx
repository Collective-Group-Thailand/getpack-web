"use client";

import { useTranslations } from "next-intl";
import { lazy, Suspense, useState } from "react";

import { IconButton } from "@/ui/components/IconButton";
import { Sheet } from "@/ui/components/Sheet";
import { Skeleton } from "@/ui/components/Skeleton";

const AssistantPanel = lazy(() => import("./AssistantPanel").then((module) => ({ default: module.AssistantPanel })));

/**
 * The assistant's button (U5.5 §1) — in the storefront header and the studio. Its panel loads on the
 * first press, in a side sheet that leaves the page as it was.
 */
export function AssistantLauncher({ signedIn, signInHref }: { signedIn: boolean; signInHref: string }) {
  const t = useTranslations("assistant");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <IconButton
        name="sparkles"
        variant="ghost"
        size="sm"
        label={t("open")}
        onClick={() => {
          setLoaded(true);
          setOpen(true);
        }}
      />
      {loaded ? (
        <Sheet open={open} onOpenChange={setOpen} title={t("title")} closeLabel={t("close")}>
          <div className="flex h-full flex-col p-4">
            <Suspense fallback={<Skeleton lines={4} />}>
              <AssistantPanel signedIn={signedIn} signInHref={signInHref} />
            </Suspense>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
