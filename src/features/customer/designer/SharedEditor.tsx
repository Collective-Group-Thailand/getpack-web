"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

import Editor from "@/features/designer/components/Editor";
import type { DesignerCatalog } from "@/features/designer/data/api";
import type { Schemas } from "@/lib/api/types";

/**
 * Editing a company design through an edit link (U4.7, D-285): the designer on the link's token —
 * each save a JSON Patch under the link's ETag (`store.studio.editShared`), a new version of the
 * owner's design. The artwork only: the box (its studio fields and price) and uploads stay with the
 * owner, so those tools are not offered.
 */
export function SharedEditor({
  token,
  shared,
  etag,
  catalog,
}: {
  token: string;
  shared: Schemas["SharedDesignDto"];
  etag: string | null;
  catalog: DesignerCatalog | null;
}) {
  const router = useRouter();
  const locale = useLocale();
  const prefix = locale === "en" ? "/en" : "";
  const document = (shared.document as { spec?: unknown; content?: unknown } | null) ?? null;
  const doc = { spec: document?.spec ?? null, content: document?.content ?? null };
  const back = `/design/shared/${token}`;

  return (
    <Editor
      id={token}
      nav={{
        home: `${prefix}/`,
        push: (href) => router.push(`${prefix}${href}`),
        replace: (href) => router.replace(`${prefix}${href}`),
      }}
      session={{
        mode: "shared",
        editable: true,
        design: {
          id: token,
          name: shared.title,
          document: doc,
          versionNo: shared.versionNo ?? 0,
          etag,
          updatedAt: shared.sharedAt,
          assets: shared.assets.flatMap((a) => (a.url ? [{ id: a.id, url: a.url }] : [])),
        },
        shared: { token, document: doc },
      }}
      catalog={catalog}
      exitHref={back}
      designHref={() => back}
      chrome={{ rail: (id) => id !== "box" && id !== "uploads" }}
    />
  );
}
