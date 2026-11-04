"use client";

import { useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { NativeSelect } from "@/ui/components/NativeSelect";

/** The quiet product-type filter beside the tabs: a URL parameter, so the view is a link. */
export function TypeSelect({
  value,
  options,
  tab,
}: {
  value: string;
  options: readonly { code: string; name: string }[];
  tab: string | null;
}) {
  const t = useTranslations("deals.type");
  const router = useRouter();
  const pathname = usePathname();
  return (
    <label className="text-muted flex items-center gap-2.5 text-sm max-md:w-full">
      <span className="max-md:sr-only">{t("label")}</span>
      <span className="block min-w-50 max-md:flex-1">
        <NativeSelect
          value={value}
          className="bg-surface max-md:h-11"
          options={[
            { value: "", label: t("all") },
            ...options.map((option) => ({ value: option.code, label: option.name })),
          ]}
          onValueChange={(next) => {
            const params = new URLSearchParams();
            if (tab) params.set("tab", tab);
            if (next) params.set("type", next);
            const query = params.toString();
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
          }}
        />
      </span>
    </label>
  );
}
