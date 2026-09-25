import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { adminServerApis } from "@/features/admin/console/api.server";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { Dashboard } from "@/features/admin/dashboard";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("dashboard"))("title") };
}

/** The admin landing page: this person's work queues first (F2 A.2.8). */
export default async function AdminHomePage() {
  let initial = null;
  try {
    initial = await (await adminServerApis()).requests.call("GET /v1/admin/dashboard");
  } catch {
    // The client asks again; a missing endpoint shows as an error state with a request id.
  }
  return (
    <ConsolePage>
      <Dashboard initial={initial} />
    </ConsolePage>
  );
}
