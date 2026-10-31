"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { DateField } from "@/ui/components/DateField";

/**
 * A console form's date (or month) field: the native picker, read at rest in the page's calendar — "31 ต.ค. 2569",
 * "ตุลาคม 2569" — instead of the browser's own ("10/31/2026", "October 2026"). The value stays ISO.
 */
export function ConsoleDateField({
  type = "date",
  value,
  ...props
}: Omit<React.ComponentProps<typeof DateField>, "display" | "value"> & { value: string | undefined | null }) {
  const t = useTranslations("console.filters");
  const format = useFormat();
  const ok = type === "month" ? /^\d{4}-\d{2}$/.test(value ?? "") : /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");
  const display = ok
    ? type === "month"
      ? format.date(`${value}-01`, { style: "month" })
      : format.date(value!)
    : type === "month"
      ? t("pickMonth")
      : t("pickDate");
  return <DateField type={type} value={value ?? ""} display={display} {...props} />;
}
