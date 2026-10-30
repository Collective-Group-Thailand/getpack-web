import { getLocale, getTranslations } from "next-intl/server";
import { allFaces, faceBounds, getStyle, isStyleId } from "@getpack/dieline";

import { DesignViewer, readDesignDocument } from "@/features/designer/components/DesignViewer";
import { dielineOf, sizeOf } from "@/features/designer/document";
import { faceNames } from "@/features/designer/lib/faceNames";
import type { DesignContent } from "@/features/designer/types";
import { formatDateTime } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { BrandLogo } from "@/ui/brand";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Icon } from "@/ui/icons";

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

  const startHref = studioHref({ product: shared.product.slug || null, step: "start" });
  const scopeIcon = shared.scope === "edit" ? "edit" : shared.scope === "comment" ? "chat" : "eye";
  // What this link lets the holder do, as one quiet note under the viewer (the scope's own words).
  const note =
    shared.scope === "edit"
      ? { title: t("canEdit"), body: t("canEditBody") }
      : shared.scope === "comment"
        ? { title: t("canComment"), body: t("canCommentBody") }
        : { title: t("viewOnly"), body: t("viewOnlyBody") };

  return (
    // Project A: the viewer dominates under a compact light bar — the wordmark and the link's one main action
    // (edit for an edit link, else "start your own"); the title, the scope and the dates in one block above it.
    <div className="bg-bg text-fg flex min-h-dvh flex-col">
      <header className="border-border bg-surface flex h-14 shrink-0 items-center gap-3 border-b px-4 md:px-6">
        <Link href="/" aria-label={t("home")} className="shrink-0">
          <BrandLogo height={22} />
        </Link>
        <span className="ms-auto">
          {shared.scope === "edit" ? (
            <Button asChild size="sm" iconStart="edit">
              <Link href={`/design/shared/${token}/edit`}>{t("edit")}</Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant={collaborative ? "secondary" : "primary"}>
              <Link href={startHref}>{t("start")}</Link>
            </Button>
          )}
        </span>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-[82.5rem] flex-1 flex-col gap-4 px-4 py-5 md:px-6 md:py-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <Badge tone="primary" icon={scopeIcon} className="mb-2">
              {t(`badges.${shared.scope}`)}
            </Badge>
            <h1 className="text-[1.5rem] leading-tight font-semibold tracking-tight md:text-[1.875rem]">
              {shared.title}
            </h1>
            <p className="text-muted mt-1 text-sm">
              {read && isStyleId(read.spec.styleId)
                ? `${getStyle(read.spec.styleId).name[locale]} · ${sizeOf(read.spec).text} ${t("mm")} · `
                : ""}
              {product ? `${product} · ` : ""}
              {t("sharedAt", { time: formatDateTime(shared.sharedAt, locale) })}
            </p>
          </div>
          <p className="border-border bg-surface text-muted rounded-control inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs">
            <Icon name="clock" size={14} aria-hidden="true" />
            {t("expiresAt", { time: formatDateTime(shared.expiresAt, locale) })}
          </p>
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
          <div className="bg-surface border-border rounded-panel aspect-[4/3] w-full border p-4 md:aspect-auto md:h-[min(68dvh,48rem)] md:p-8">
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
        <div className="bg-primary-subtle flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm">
          <Icon name="info" size={18} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
          <p className="m-0">
            <b className="font-semibold">{note.title}</b> <span className="text-muted">· {note.body}</span>
          </p>
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
