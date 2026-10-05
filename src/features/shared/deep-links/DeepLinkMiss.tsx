import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/ui/components/EmptyState";

/**
 * A notification link that cannot be followed (D-299): expired, or not this account's. Never a
 * dead end (U5.1 §3) — the zone passes the places the same thing can be found from.
 */
export async function DeepLinkMiss({ reason, actions }: { reason: "expired" | "not-found"; actions: React.ReactNode }) {
  const t = await getTranslations("common.deepLink");
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16">
      <h1 className="sr-only">{t(`${reason}.title`)}</h1>
      <EmptyState
        icon={reason === "expired" ? "clock" : "link"}
        title={t(`${reason}.title`)}
        description={t(`${reason}.body`)}
        action={actions}
      />
    </div>
  );
}
