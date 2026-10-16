import { getLocale, getTranslations } from "next-intl/server";
import { allFaces, faceBounds, getStyle, isStyleId } from "@getpack/dieline";

import { DesignViewer, readDesignDocument } from "@/features/designer/components/DesignViewer";
import { dielineOf, sizeOf } from "@/features/designer/document";
import { faceNames } from "@/features/designer/lib/faceNames";
import type { DesignContent } from "@/features/designer/types";
import { formatDateTime } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { BrandLogo } from "@/ui/brand";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";

import { pick } from "../catalog/localize";
import type { SharedDesignData } from "./api.server";
import { studioHref } from "@/features/customer/studio/paths";

import { SharedComments } from "./SharedComments";

/** Image sources from the assets' signed URLs (ids are kept in the document; URLs expire). */
function withAssets(content: DesignContent, assets: SharedDesignData["assets"]): DesignContent {
  const urls = new Map(assets.flatMap((a) => (a.url ? [[a.id, a.url] as const] : [])));
  return {
    ...content,
    elements: content.elements.map((el) =>
      el.type === "image" && el.assetId && urls.has(el.assetId) ? { ...el, src: urls.get(el.assetId)! } : el,
    ),
  };
}

/**
 * A shared design: the flat sheet with its artwork, and a way to start one's own. A comment link
 * adds the threads and pinning (U4.7); an edit link also opens the design in the editor.
 */
export async function SharedDesign({ shared, token }: { shared: SharedDesignData; token: string }) {
  const t = await getTranslations("designer.shared");
  const tPosition = await getTranslations("designer.box.position");
  const locale = (await getLocale()) as "th" | "en";
  // The document is opaque in the contract: `{ spec, content }` as the designer saved it.
  const document = shared.document as { spec?: Record<string, unknown>; content?: Record<string, unknown> } | null;
  const read =
    document?.spec && document.content ? readDesignDocument({ spec: document.spec, content: document.content }) : null;
  const product = pick(locale, shared.product.nameTh, shared.product.nameEn);
  const collaborative = shared.scope === "comment" || shared.scope === "edit";

  return (
    <div className="bg-canvas text-fg flex min-h-dvh flex-col">
      <header className="bg-neutral text-neutral-fg flex h-14 items-center gap-3 px-4">
        <Link href="/" aria-label={t("home")}>
          <BrandLogo height={30} />
        </Link>
        <span className="text-sm">{t(`badges.${shared.scope}`)}</span>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6">
        <div>
          <h1 className="text-xl font-semibold">{shared.title}</h1>
          <p className="text-muted text-sm">
            {read && isStyleId(read.spec.styleId)
              ? `${getStyle(read.spec.styleId).name[locale]} · ${sizeOf(read.spec).text} ${t("mm")} · `
              : ""}
            {product ? `${product} · ` : ""}
            {t("sharedAt", { time: formatDateTime(shared.sharedAt, locale) })}
          </p>
          <p className="text-muted text-xs">{t("expiresAt", { time: formatDateTime(shared.expiresAt, locale) })}</p>
        </div>
        {read && collaborative ? (
          <SharedComments
            token={token}
            {...geometryOf(read.spec, locale, {
              top: tPosition("top"),
              bottom: tPosition("bottom"),
              left: tPosition("left"),
              right: tPosition("right"),
            })}
          >
            <DesignViewer
              spec={read.spec}
              content={withAssets(read.content, shared.assets)}
              label={shared.title}
              idPrefix="shared"
            />
          </SharedComments>
        ) : read ? (
          <div className="bg-surface border-border aspect-[4/3] w-full rounded-xl border p-4">
            <DesignViewer
              spec={read.spec}
              content={withAssets(read.content, shared.assets)}
              label={shared.title}
              idPrefix="shared"
            />
          </div>
        ) : (
          <Callout tone="warning" title={t("unreadable")} />
        )}
        {shared.scope === "edit" ? (
          <Callout tone="info" title={t("canEdit")}>
            <p className="mb-2">{t("canEditBody")}</p>
            <Button asChild size="sm">
              <Link href={`/design/shared/${token}/edit`}>{t("edit")}</Link>
            </Button>
          </Callout>
        ) : shared.scope === "comment" ? (
          <Callout tone="info" title={t("canComment")}>
            {t("canCommentBody")}
          </Callout>
        ) : (
          <Callout tone="info" title={t("viewOnly")}>
            {t("viewOnlyBody")}
          </Callout>
        )}
        <div>
          <Button asChild>
            <Link href={studioHref({ product: shared.product.slug || null, step: "start" })}>{t("start")}</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

/** The viewer's viewBox (as `DesignViewer` draws it) and each face's bounds and name, for the pins. */
function geometryOf(
  spec: Parameters<typeof dielineOf>[0],
  locale: "th" | "en",
  words: Parameters<typeof faceNames>[2],
) {
  const d = dielineOf(spec);
  const pad = Math.max(d.width, d.height) * 0.04;
  const faces = allFaces(d);
  return {
    viewBox: { x: -pad, y: -pad, width: d.width + pad * 2, height: d.height + pad * 2 },
    faceBounds: Object.fromEntries(faces.map((f) => [f.id, faceBounds(f)])),
    faceLabels: Object.fromEntries(faceNames(d, locale, words)),
  };
}
