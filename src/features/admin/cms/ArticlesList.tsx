"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { CONTENT_STATUS } from "@/domain/status";
import { When } from "@/features/shared/format";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { ResourceList, StatusChip, useCan, type InitialPage } from "../console";
import type { CatalogueRow } from "../catalogue/api";
import { listFor } from "../catalogue/resources";
import { tableByKey } from "../catalogue/tables";
import { useRefs } from "../catalogue/useRefs";

/** Articles: the list, each opening its own editor page — TipTap does not fit in a side sheet. */
export function ArticlesList({ initial }: { initial: InitialPage<CatalogueRow> | null }) {
  const t = useTranslations("catalogue.articles");
  const tStatus = useTranslations("status");
  const canManage = useCan("cms.manage");
  const refs = useRefs(["article-categories"]);
  const def = tableByKey("articles")!;

  const columns: DataTableColumn<CatalogueRow>[] = [
    {
      id: "titleTh",
      header: t("title"),
      sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/cms/articles/${row.id}`} className="text-primary font-medium hover:underline">
            {String(row.titleTh)}
          </Link>
          <p className="text-muted text-xs tabular-nums">{String(row.slug)}</p>
        </div>
      ),
    },
    {
      id: "categoryIds",
      header: t("categories"),
      cell: (row) =>
        (Array.isArray(row.categoryIds) ? (row.categoryIds as string[]) : [])
          .map((id) => refs.labels["article-categories"]?.get(id) ?? id.slice(0, 8))
          .join(", ") || <span className="text-muted">–</span>,
    },
    {
      id: "status",
      header: t("status"),
      cell: (row) => <StatusChip map={CONTENT_STATUS} value={String(row.status)} />,
    },
    {
      id: "publishedAt",
      header: t("publishedAt"),
      cell: (row) => (row.publishedAt ? <When at={String(row.publishedAt)} /> : <span className="text-muted">–</span>),
    },
    { id: "updatedAt", header: t("updatedAt"), hideable: true, cell: (row) => <When at={String(row.updatedAt)} /> },
  ];

  return (
    <ResourceList
      resource={listFor(def)}
      columns={columns}
      caption={t("list")}
      initial={initial}
      searchLabel={t("search")}
      filters={[
        {
          id: "status",
          label: t("status"),
          kind: "select",
          options: Object.entries(CONTENT_STATUS).map(([value, meta]) => ({ value, label: tStatus(meta.labelKey) })),
        },
        { id: "categoryId", label: t("categories"), kind: "select", options: refs.options["article-categories"] ?? [] },
      ]}
      toolbarEnd={
        canManage ? (
          <Button size="sm" iconStart="plus" asChild>
            <Link href="/cms/articles/new">{t("new")}</Link>
          </Button>
        ) : null
      }
      empty={{ title: t("emptyTitle"), description: t("emptyBody") }}
    />
  );
}
