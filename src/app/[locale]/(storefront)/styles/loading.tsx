import { useTranslations } from "next-intl";

import { PageSkeleton } from "@/ui/components/PageSkeleton";

/** The style library loading (U5.7 §2). */
export default function Loading() {
  const t = useTranslations("common.state");
  return <PageSkeleton shape="grid" label={t("loading")} className="mx-auto max-w-6xl px-4 py-10" />;
}
