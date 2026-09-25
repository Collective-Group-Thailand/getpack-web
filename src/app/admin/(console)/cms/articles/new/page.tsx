import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ArticleEditor } from "@/features/admin/cms";
import { ConsolePage } from "@/features/admin/console/ConsolePage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("catalogue.articles"))("new") };
}

export default async function NewArticlePage() {
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <ArticleEditor articleId={null} />
    </ConsolePage>
  );
}
