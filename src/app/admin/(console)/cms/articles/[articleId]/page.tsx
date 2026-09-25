import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ArticleEditor } from "@/features/admin/cms";
import { ConsolePage } from "@/features/admin/console/ConsolePage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("catalogue.articles"))("editTitle") };
}

type Props = { params: Promise<{ articleId: string }> };

export default async function ArticlePage({ params }: Props) {
  const { articleId } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <ArticleEditor articleId={articleId} />
    </ConsolePage>
  );
}
