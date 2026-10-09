import { useTranslations } from "next-intl";

import { PageSkeleton } from "@/ui/components/PageSkeleton";

/**
 * Every factory screen while its data loads: the shell stays, the page shows its shape at once.
 * Without it a tap on a slow connection seems to do nothing, and an owner taps again.
 */
export default function Loading() {
  const t = useTranslations("common.state");
  return (
    <PageSkeleton shape="list" label={t("loading")} className="mx-auto w-full max-w-5xl px-4 py-5 md:px-6 md:py-8" />
  );
}
