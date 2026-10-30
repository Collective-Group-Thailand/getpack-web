"use client";

import { useRouter } from "next/navigation";

import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";

/** "เรียงตาม": the phone's own picker; choosing one replaces the URL (the server sorts). */
export function SortMenu<T extends string>({
  label,
  value,
  options,
  hrefFor,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  /** Hrefs keyed by option, built on the server (the client cannot rebuild the locale's path). */
  hrefFor: Record<T, string>;
}) {
  const router = useRouter();
  return (
    <label className="text-muted flex items-center gap-2 text-sm">
      {label}
      <SearchableSelect
        value={value}
        options={options}
        onValueChange={(next) => router.replace(hrefFor[next], { scroll: false })}
        className="w-auto min-w-36"
      />
    </label>
  );
}
