import { useTranslations } from "next-intl";

import { PageSkeleton } from "@/ui/components/PageSkeleton";

/** The account while its reads arrive (U5.7 §2): shaped like the launchpad. */
export default function Loading() {
  const t = useTranslations("common.state");
  return <PageSkeleton shape="dashboard" label={t("loading")} />;
}
