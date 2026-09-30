"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { adminDesignActions } from "@/domain/next-actions/admin";
import { useActor } from "@/features/admin/console/actor";
import { problemMessage } from "@/features/admin/console/QueryError";
import Editor from "@/features/designer/components/Editor";
import { adminDocuments, type AdminDesignDocument } from "@/features/designer/data/api";
import { documentOf } from "@/features/designer/data/published";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

/**
 * The designer for the back office (F4 C.2), on `admin.designs.get` / `.save` (If-Match). Prepress
 * never changes a customer's document: it makes a copy (still a request, `admin.design-documents`).
 *
 * CONTRACT-GAP admin.design-documents — no `editable` flag or owner is published, so whether the
 * designer opens editable follows `adminDesignActions` (the save permission); packio-api saves only
 * the staff author's own designs and refuses the rest, which the designer shows as a failed save.
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
  const actor = useActor();
  const offered = adminDesignActions((permission) => actor.permissions.includes(permission));
  const [copying, setCopying] = useState(false);

  const copy = async () => {
    setCopying(true);
    try {
      const created = await adminDocuments.copy(document.id, t("copyTitle", { title: document.title }));
      toast.success(t("copied", { title: created.title }));
      router.push(`/designs/${created.id}?from=${encodeURIComponent(exitHref)}`);
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
        editable: offered.save,
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
        offered.copy ? (
          <Button size="sm" iconStart="copy" loading={copying} onClick={() => void copy()}>
            {t("copy")}
          </Button>
        ) : null
      }
    />
  );
}
