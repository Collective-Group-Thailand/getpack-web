import { useTranslations } from "next-intl";

import { PageSkeleton } from "@/ui/components/PageSkeleton";

/** A conversation loading (U5.7 §2). */
export default function Loading() {
  const t = useTranslations("common.state");
  return <PageSkeleton shape="thread" label={t("loading")} />;
}
