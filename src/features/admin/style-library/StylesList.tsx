"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { useFormat, When } from "@/features/shared/format";
import { Badge } from "@/ui/components/Badge";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { QueueTabs, ResourceList, type InitialPage } from "../console";
import { type AdminStyle, STYLE_CATEGORIES, styleDeskHref, stylesList } from "./resources";

/**
 * The style library's bases (D-411): what each one shows on the storefront (publishable of its
 * variants), whether Prepress approved its recipe, Marketing and Prepress its names, and how it is
 * curated (featured, hidden). Shown / not shown are the queues; category and status filter.
 */
export function StylesList({ initial }: { initial: InitialPage<AdminStyle> | null }) {
  const t = useTranslations("styleLibrary.list");
  const tStyles = useTranslations("styles");
  const format = useFormat();

  const columns: DataTableColumn<AdminStyle>[] = [
    {
      id: "code",
      header: t("columns.style"),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={styleDeskHref(row.id)} className="text-primary font-medium hover:underline">
            {row.nameTh}
          </Link>
          <p className="text-muted text-xs">
            <span className="font-mono">{row.code}</span> · {row.nameEn}
          </p>
        </div>
      ),
    },
    {
      id: "category",
      header: t("columns.category"),
      cell: (row) => (tStyles.has(`categories.${row.category}`) ? tStyles(`categories.${row.category}`) : row.category),
    },
    {
      id: "variants",
      header: t("columns.variants"),
      numeric: true,
      cell: (row) => (
        <span className={row.variants.publishable === 0 ? "text-danger tabular-nums" : "tabular-nums"}>
          {t("shownOf", {
            shown: format.number(row.variants.publishable),
            total: format.number(row.variants.active),
          })}
        </span>
      ),
    },
    {
      id: "recipe",
      header: t("columns.recipe"),
      cell: (row) =>
        row.recipeVersion === null ? (
          <Badge tone="danger" size="sm">
            {t("noRecipe")}
          </Badge>
        ) : row.recipeApproved ? (
          <Badge tone="success" size="sm" icon="check">
            {t("recipeApproved", { version: row.recipeVersion })}
          </Badge>
        ) : (
          <Badge tone="warning" size="sm">
            {t("recipeWaiting", { version: row.recipeVersion })}
          </Badge>
        ),
    },
    {
      id: "names",
      header: t("columns.names"),
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          <Badge tone={row.namesApproval.marketingAt ? "success" : "neutral"} size="sm">
            {t("marketing")}
            {row.namesApproval.marketingAt ? " ✓" : ""}
          </Badge>
          <Badge tone={row.namesApproval.prepressAt ? "success" : "neutral"} size="sm">
            {t("prepress")}
            {row.namesApproval.prepressAt ? " ✓" : ""}
          </Badge>
        </span>
      ),
    },
    {
      id: "curation",
      header: t("columns.curation"),
      hideable: true,
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.featured ? (
            <Badge tone="primary" size="sm">
              {t("featured")}
            </Badge>
          ) : null}
          {row.hidden ? (
            <Badge tone="warning" size="sm">
              {t("hidden")}
            </Badge>
          ) : null}
          {row.status === "retired" ? (
            <Badge tone="neutral" size="sm">
              {t("retired")}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: "publishedAt",
      header: t("columns.published"),
      hideable: true,
      cell: (row) => <When at={row.publishedAt} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("queuesLabel")}
        param="published"
        tabs={[
          { value: null, label: t("all") },
          { value: "true", label: t("shown") },
          { value: "false", label: t("notShown") },
        ]}
      />
      <ResourceList
        resource={stylesList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        searchPlaceholder={t("searchPlaceholder")}
        rowHref={(row) => styleDeskHref(row.id)}
        filters={[
          {
            id: "category",
            label: t("columns.category"),
            kind: "select",
            options: STYLE_CATEGORIES.map((value) => ({ value, label: tStyles(`categories.${value}`) })),
          },
          {
            id: "status",
            label: t("columns.status"),
            kind: "select",
            options: [
              { value: "active", label: t("active") },
              { value: "retired", label: t("retired") },
            ],
          },
        ]}
        rowTone={(row) => (row.variants.publishable === 0 && row.status === "active" ? "warning" : undefined)}
        empty={{ title: t("empty") }}
      />
    </div>
  );
}
