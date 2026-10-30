"use client";

import { useRouter as useNextRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import { Icon } from "@/ui/icons";

import { useCompare } from "./compare-store";
import { compareHref, STYLES_HREF } from "./paths";

/**
 * Remove a style from the comparison: out of the chosen set (the tray follows) and out of the address, so the
 * table — on the page or in the dialog — redraws with the rest. Inside the photo's corner, never clipped.
 */
export function CompareRemove({ code, name, remaining }: { code: string; name: string; remaining: string[] }) {
  const t = useTranslations("styles.library");
  const compare = useCompare();
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={t("compareRemove", { code: name })}
      onClick={() => {
        compare.remove(code);
        router.replace(compareHref(remaining), { scroll: false });
      }}
      className="bg-surface/95 text-fg border-border hover:bg-surface focus-visible:ring-focus-ring absolute end-2 top-2 grid size-8 place-items-center rounded-full border outline-none focus-visible:ring-2"
    >
      <Icon name="close" size={14} aria-hidden="true" />
    </button>
  );
}

/**
 * The dashed column while there is room: in the dialog it closes back to the library (the choice kept, so the
 * visitor picks one more and compares again); on the page it goes to the library.
 */
export function CompareAddSlot({ inDialog, label }: { inDialog: boolean; label: string }) {
  const router = useNextRouter();
  const className =
    "border-border-strong text-muted hover:border-primary hover:text-primary focus-visible:ring-focus-ring flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-sm font-medium outline-none focus-visible:ring-2";
  const content = (
    <>
      <Icon name="plus" size={22} aria-hidden="true" />
      {label}
    </>
  );
  return inDialog ? (
    <button type="button" className={className} onClick={() => router.back()}>
      {content}
    </button>
  ) : (
    <Link href={STYLES_HREF} className={className}>
      {content}
    </Link>
  );
}
