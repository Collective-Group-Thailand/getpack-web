import type { Schemas } from "@/lib/api/types";
import { cn } from "@/ui/lib/cn";

type SpecLabel = Pick<Schemas["LocalisedLabelDto"], "th"> & { en?: string | null };

/**
 * The one string that says which specification a price is for (D-441): the API's
 * `specLabel` / `startingPriceAssumes.label` / `basis.label`, in the reader's language and in the
 * API's words — sizes ยาว × กว้าง × สูง in mm, "ไม่พิมพ์" when nothing prints. It is never built
 * here: no dimension, option name or VAT wording is composed in the web. English falls back to
 * Thai, which every record has.
 */
export function specLabelText(label: SpecLabel | null | undefined, locale: string): string | null {
  if (!label) return null;
  const text = (locale === "en" && label.en ? label.en : label.th).trim();
  return text === "" ? null : text;
}

/** The label as a quiet line under a price — nothing at all when the API sent none. */
export function SpecLabelLine({
  label,
  locale,
  className,
}: {
  label: SpecLabel | null | undefined;
  locale: string;
  className?: string;
}) {
  const text = specLabelText(label, locale);
  return text ? <span className={cn("text-muted block text-xs leading-snug", className)}>{text}</span> : null;
}
