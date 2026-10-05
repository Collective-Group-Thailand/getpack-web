"use client";

import { useTranslations } from "next-intl";
import { lazy, Suspense, useState } from "react";

import { Icon } from "@/ui/icons";

const GlossaryChipPopover = lazy(() => import("./GlossaryChipPopover"));

const chipClass =
  "text-muted hover:text-primary focus-visible:ring-focus-ring inline-flex size-6 items-center justify-center rounded-full align-middle outline-none focus-visible:ring-2";

/**
 * A jargon word's "?" (U5.2 §3). Until it is pressed it is a plain button: the popover, its query
 * and the glossary's request client load on the first press and open at once, so a page full of
 * chips costs its first paint nothing (the configurator's script budget).
 */
export function GlossaryChip({ slug, label }: { slug: string; label?: string }) {
  const t = useTranslations("help.glossary");
  const [wanted, setWanted] = useState(false);
  const name = label ?? t("thisTerm");
  if (!wanted)
    return (
      <button
        type="button"
        className={chipClass}
        aria-label={t("chipLabel", { term: name })}
        onClick={() => setWanted(true)}
      >
        <Icon name="help" size={14} />
      </button>
    );
  return (
    <Suspense
      fallback={
        <span className={chipClass} aria-busy="true">
          <Icon name="help" size={14} />
        </span>
      }
    >
      <GlossaryChipPopover slug={slug} label={label} initiallyOpen />
    </Suspense>
  );
}
