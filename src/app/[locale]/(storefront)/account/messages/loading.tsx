import { useTranslations } from "next-intl";

import { PageSkeleton } from "@/ui/components/PageSkeleton";

/** Conversations loading (U5.7 §2). */
export default function Loading() {
  const t = useTranslations("common.state");
  return <PageSkeleton shape="list" label={t("loading")} />;
}
