import { getLocale, getTranslations } from "next-intl/server";
import { getStyle, isStyleId } from "@packio/dieline";

import { DesignViewer, readDesignDocument } from "@/features/designer/components/DesignViewer";
import { sizeOf } from "@/features/designer/document";
import type { DesignContent } from "@/features/designer/types";
import { formatDateTime } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { BrandMark } from "@/ui/brand";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";

import type { SharedDesignData } from "./api.server";

/** Image sources from the assets' signed URLs (ids are kept in the document; URLs expire). */
function withAssets(content: DesignContent, assets: SharedDesignData["assets"]): DesignContent {
  const urls = new Map(assets.map((a) => [a.id, a.url]));
  return {
    ...content,
    elements: content.elements.map((el) =>
      el.type === "image" && el.assetId && urls.has(el.assetId) ? { ...el, src: urls.get(el.assetId)! } : el,
    ),
  };
}

/** A shared design, read-only: the flat sheet with its artwork, and a way to start one's own. */
export async function SharedDesign({ shared }: { shared: SharedDesignData }) {
  const t = await getTranslations("designer.shared");
  const locale = (await getLocale()) as "th" | "en";
  const read = readDesignDocument(shared.document);

  return (
    <div className="bg-canvas text-fg flex min-h-dvh flex-col">
      <header className="bg-neutral text-neutral-fg flex h-14 items-center gap-3 px-4">
        <Link href="/" aria-label={t("home")}>
          <BrandMark size={30} />
        </Link>
        <span className="text-sm">{t("badge")}</span>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6">
        <div>
          <h1 className="text-xl font-semibold">{shared.name}</h1>
          <p className="text-muted text-sm">
            {read && isStyleId(read.spec.styleId)
              ? `${getStyle(read.spec.styleId).name[locale]} · ${sizeOf(read.spec).text} ${t("mm")} · `
              : ""}
            {t("sharedAt", { time: formatDateTime(shared.sharedAt, locale) })}
          </p>
        </div>
        {read ? (
          <div className="bg-surface border-border aspect-[4/3] w-full rounded-xl border p-4">
            <DesignViewer
              spec={read.spec}
              content={withAssets(read.content, shared.assets)}
              label={shared.name}
              idPrefix="shared"
            />
          </div>
        ) : (
          <Callout tone="warning" title={t("unreadable")} />
        )}
        <Callout tone="info" title={t("viewOnly")}>
          {t("viewOnlyBody")}
        </Callout>
        <div>
          <Button asChild>
            <Link href="/design/new">{t("start")}</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
