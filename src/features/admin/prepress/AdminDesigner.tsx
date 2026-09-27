"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import Editor from "@/features/designer/components/Editor";
import { adminDocuments, type AdminDesignDocument } from "@/features/designer/data/api";
import { problemMessage } from "@/features/admin/console/QueryError";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

/**
 * The designer for prepress. A customer's design opens read-only — prepress never changes the
 * customer's document — with one action, *make a copy*; a copy opens editable and saves under
 * `If-Match` like any account design.
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
        editable: document.editable,
        design: {
          id: document.id,
          name: document.title,
          document: document.document,
          versionNo: document.versionNo,
          etag,
          updatedAt: document.updatedAt,
        },
      }}
      catalog={null}
      exitHref={exitHref}
      designHref={(id) => `/designs/${id}`}
      primaryAction={
        document.editable ? null : (
          <Button size="sm" iconStart="copy" loading={copying} onClick={() => void copy()}>
            {t("copy")}
          </Button>
        )
      }
    />
  );
}
