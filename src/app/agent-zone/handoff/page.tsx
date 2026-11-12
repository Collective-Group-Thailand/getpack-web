import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Handoff } from "@/features/agent/auth/Handoff";
import { BrandLogo } from "@/ui/brand";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agentZone.handoff");
  return { title: t("opening"), referrer: "no-referrer" };
}

/** Where "เปิด getpack Agent" on getpack.co lands (D-467): the code is in the fragment; `Handoff` redeems it. */
export default function HandoffPage() {
  return (
    <main id="main" className="bg-bg flex min-h-dvh flex-col items-center justify-center gap-8 px-5 py-12">
      <BrandLogo height={28} />
      <div className="border-border bg-surface rounded-panel shadow-card w-full max-w-md border p-6 sm:p-8">
        <Handoff />
      </div>
    </main>
  );
}
