import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { StyleWorkspace } from "@/features/admin/style-library";
import { serverEnv } from "@/lib/env/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("styleLibrary.detail"))("title") };
}

type Props = { params: Promise<{ styleId: string }> };

/** The storefront's origin, for "see it on the storefront" (a host value carries no scheme). */
function storefrontOrigin(): string | null {
  const host = serverEnv.PUBLIC_HOST;
  if (!host) return null;
  return `${/^(localhost|127\.)/.test(host) ? "http" : "https"}://${host}`;
}

export default async function StylePage({ params }: Props) {
  const { styleId } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <StyleWorkspace styleId={styleId} storefront={storefrontOrigin()} />
    </ConsolePage>
  );
}
