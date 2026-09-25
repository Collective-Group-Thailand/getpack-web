import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { adminServerApis } from "@/features/admin/console/api.server";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { CustomerDetail } from "@/features/admin/customers";
import { CUSTOMER_TABS, type CustomerTab } from "@/features/admin/customers/resources";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("customers.detail"))("title") };
}

type Props = {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomerPage({ params, searchParams }: Props) {
  const [{ customerId }, query] = await Promise.all([params, searchParams]);
  const tab = (CUSTOMER_TABS as readonly string[]).includes(String(query.tab)) ? (query.tab as CustomerTab) : "profile";
  let initial = null;
  try {
    initial = await (
      await adminServerApis()
    ).requests.call("GET /v1/admin/customers/{customerId}", {
      path: { customerId },
    });
  } catch {
    // Rendered by the client as the API answered it.
  }
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <CustomerDetail customerId={customerId} initial={initial} tab={tab} />
    </ConsolePage>
  );
}
