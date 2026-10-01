"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useCan } from "@/features/admin/console/actor";
import { problemMessage } from "@/features/admin/console/QueryError";
import Editor from "@/features/designer/components/Editor";
import { adminDocuments, type AdminDesignDocument } from "@/features/designer/data/api";
import { documentOf } from "@/features/designer/data/published";
import { newIdempotencyKey } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

/**
 * The designer for the back office (F4 C.2), on `admin.designs.get` / `.save` (If-Match). Prepress
 * never changes a customer's document: it makes a copy (`admin.designs.copy`), which it owns.
 * The designer opens editable when the API says so (`editable`: the reader's own copy) and the
 * reader may save (`catalog.manage`, the save's permission); anything else is read-only, owner
 * named. A save the API still refuses (409 `designs.read_only`) shows as a failed save.
 */
export function AdminDesigner({
  document,
  etag,
  exitHref,
}: {
  document: AdminDesignDocument;
  etag: string | null;
  exitHref: string;
}) {
  const t = useTranslations("prepress.detail.design");
  const router = useRouter();
  const canSave = useCan("catalog.manage");
  const canCopy = useCan("prepress.review");
  const editable = document.editable && canSave;
  const [copying, setCopying] = useState(false);
  // One copy per intent: a retry after a timeout replays it instead of making a second.
  const [copyKey] = useState(newIdempotencyKey);

  const copy = async () => {
    setCopying(true);
    try {
      const created = await adminDocuments.copy(document.id, t("copyTitle", { title: document.title }), copyKey);
      toast.success(t("copied", { title: created.data.title }));
      router.push(`/designs/${created.data.id}?from=${encodeURIComponent(exitHref)}`);
    } catch (error) {
      toast.error(problemMessage(error, t("copyFailed")));
      setCopying(false);
    }
  };

  return (
    <Editor
      id={document.id}
      nav={{ home: "/", push: (href) => router.push(href), replace: (href) => router.replace(href) }}
      session={{
        mode: "admin",
        editable,
        design: {
          id: document.id,
          name: document.title,
          document: documentOf(document) ?? { spec: null, content: null },
          versionNo: document.versionNo ?? 0,
          etag,
          updatedAt: document.updatedAt,
        },
      }}
      catalog={null}
      exitHref={exitHref}
      designHref={(id) => `/designs/${id}`}
      primaryAction={
        <span className="flex items-center gap-2">
          <span className="text-muted hidden text-xs sm:inline">
            {t(document.owner.kind === "staff" ? "ownerStaff" : "ownerCustomer", { name: document.owner.displayName })}
          </span>
          {canCopy && !document.editable ? (
            <Button size="sm" iconStart="copy" loading={copying} onClick={() => void copy()}>
              {t("copy")}
            </Button>
          ) : null}
        </span>
      }
    />
  );
}
