"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { CONTENT_STATUS } from "@/domain/status";
import { When } from "@/features/shared/format";
import { ifMatch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import type { RichTextDocument } from "@/ui/components/RichTextEditor";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { Skeleton } from "@/ui/components/Skeleton";
import { Tabs } from "@/ui/components/Tabs";
import { toast } from "@/ui/components/Toast";

import { ConfirmAction, problemMessage, QueryError, StatusChip, useCan } from "../console";
import { adminBrowserApis } from "../console/api";
import { createRow, deleteRow, getRow, loose, updateRow, type CatalogueRow } from "../catalogue/api";
import { FileField } from "../catalogue/FileField";
import { NONE } from "../catalogue/form-model";
import { listFor } from "../catalogue/resources";
import { tableByKey } from "../catalogue/tables";
import { useRefs } from "../catalogue/useRefs";

// TipTap is large and only this screen needs it: loaded on the client, on demand.
const RichTextEditor = dynamic(() => import("@/ui/components/RichTextEditor").then((mod) => mod.RichTextEditor), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full" />,
});

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LOCALES = ["th", "en"] as const;

type Draft = {
  titleTh: string;
  titleEn: string;
  slug: string;
  excerptTh: string;
  excerptEn: string;
  coverFileId: string;
  seoPageId: string;
  status: string;
  categoryIds: string[];
  body: Partial<Record<(typeof LOCALES)[number], RichTextDocument>>;
};

function draftOf(row: CatalogueRow | null): Draft {
  return {
    titleTh: String(row?.titleTh ?? ""),
    titleEn: String(row?.titleEn ?? ""),
    slug: String(row?.slug ?? ""),
    excerptTh: String(row?.excerptTh ?? ""),
    excerptEn: String(row?.excerptEn ?? ""),
    coverFileId: String(row?.coverFileId ?? ""),
    seoPageId: String(row?.seoPageId ?? ""),
    status: String(row?.status ?? "draft"),
    categoryIds: Array.isArray(row?.categoryIds) ? (row.categoryIds as string[]) : [],
    body: (row?.body as Draft["body"]) ?? {},
  };
}

const orNull = (value: string) => (value.trim() ? value.trim() : null);

/**
 * One article (F2 2.5 "articles (TipTap, SEO fields, categories)"): Thai and English title,
 * excerpt and body side by side as tabs, the slug, the SEO page, the categories and the status.
 * Saving sends the article under its `ETag`, then the category list under the new one — two
 * requests, because the contract keeps categories as their own replaceable list.
 */
export function ArticleEditor({ articleId }: { articleId: string | null }) {
  const t = useTranslations("catalogue.articles");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const canManage = useCan("cms.manage");
  const def = tableByKey("articles")!;
  const refs = useRefs(["article-categories", "seo-pages"]);
  const [edited, setDraft] = useState<Draft | null>(null);
  const [touched, setTouched] = useState(false);
  const [removing, setRemoving] = useState(false);

  const article = useQuery({
    queryKey: queryKeys.detail("admin", listFor(def).key, articleId ?? "new"),
    queryFn: async () => (await getRow(adminBrowserApis().contract, def.path, articleId!)).row,
    enabled: Boolean(articleId),
  });

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      const { contract } = adminBrowserApis();
      const body = {
        titleTh: value.titleTh.trim(),
        titleEn: orNull(value.titleEn),
        slug: value.slug.trim(),
        excerptTh: orNull(value.excerptTh),
        excerptEn: orNull(value.excerptEn),
        coverFileId: orNull(value.coverFileId),
        seoPageId: value.seoPageId && value.seoPageId !== NONE ? value.seoPageId : null,
        status: value.status,
        body: value.body,
      };
      const saved = articleId
        ? await updateRow(contract, def.path, articleId, body)
        : await createRow(contract, def.path, body);
      const before = Array.isArray(saved.categoryIds) ? (saved.categoryIds as string[]) : [];
      if (before.slice().sort().join() !== value.categoryIds.slice().sort().join()) {
        const { etag } = await getRow(contract, def.path, saved.id);
        await loose(contract).PUT(`${def.path}/{id}/categories`, {
          params: { path: { id: saved.id } },
          body: { categoryIds: value.categoryIds },
          headers: ifMatch(etag),
        });
      }
      return saved;
    },
    onSuccess: (saved) => {
      toast.success(t("saved"));
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", listFor(def).key) });
      if (!articleId) router.replace(`/cms/articles/${saved.id}`);
    },
    onError: (error) => toast.error(problemMessage(error, t("saveFailed"))),
  });

  // What is on screen: the edits so far, else the article as loaded, else a new one.
  const draft = edited ?? (articleId ? (article.data ? draftOf(article.data) : null) : draftOf(null));
  if (article.isError) return <QueryError error={article.error} onRetry={() => void article.refetch()} />;
  if (!draft) return <Skeleton className="h-96 w-full" />;

  const update = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const errors = {
    titleTh: !draft.titleTh.trim() ? t("errors.title") : undefined,
    slug: !SLUG.test(draft.slug.trim()) ? t("errors.slug") : undefined,
  };
  const invalid = Object.values(errors).some(Boolean);

  const editorLabels = {
    toolbar: t("editor.toolbar"),
    bold: t("editor.bold"),
    italic: t("editor.italic"),
    heading2: t("editor.heading2"),
    heading3: t("editor.heading3"),
    bulletList: t("editor.bulletList"),
    orderedList: t("editor.orderedList"),
    quote: t("editor.quote"),
    undo: t("editor.undo"),
    redo: t("editor.redo"),
  };

  const localeTab = (locale: (typeof LOCALES)[number]) => {
    const suffix = locale === "th" ? "Th" : "En";
    return {
      value: locale,
      label: t(`locales.${locale}`),
      content: (
        <div className="flex flex-col gap-4 pt-2">
          <Field
            label={t("title")}
            required={locale === "th"}
            requiredLabel={tCommon("state.required")}
            error={locale === "th" && touched ? errors.titleTh : undefined}
          >
            <Input
              value={draft[`title${suffix}`]}
              onChange={(event) => update({ [`title${suffix}`]: event.target.value } as Partial<Draft>)}
            />
          </Field>
          <Field label={t("excerpt")} hint={t("excerptHint")}>
            <Textarea
              rows={2}
              value={draft[`excerpt${suffix}`]}
              onChange={(event) => update({ [`excerpt${suffix}`]: event.target.value } as Partial<Draft>)}
            />
          </Field>
          <div>
            <p className="mb-1 text-sm font-medium">{t("body")}</p>
            <RichTextEditor
              value={draft.body[locale] ?? null}
              onChange={(doc) => update({ body: { ...draft.body, [locale]: doc } })}
              label={t("bodyLabel", { locale: t(`locales.${locale}`) })}
              labels={editorLabels}
            />
          </div>
        </div>
      ),
    };
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[
              { label: t("cms"), href: "/cms" },
              { label: t("list"), href: "/cms/articles" },
              { label: articleId ? draft.titleTh || t("untitled") : t("new") },
            ]}
          />
        }
        title={articleId ? draft.titleTh || t("untitled") : t("new")}
        meta={
          articleId && article.data ? (
            <StatusChip map={CONTENT_STATUS} value={String(article.data.status)} size="md" />
          ) : null
        }
        description={
          article.data?.publishedAt ? (
            <span>
              {t("publishedAt")} <When at={String(article.data.publishedAt)} />
            </span>
          ) : undefined
        }
        actions={
          canManage ? (
            <>
              {articleId ? (
                <Button variant="ghost" iconStart="trash" onClick={() => setRemoving(true)}>
                  {t("delete")}
                </Button>
              ) : null}
              <Button
                iconStart="save"
                loading={save.isPending}
                onClick={() => {
                  setTouched(true);
                  if (!invalid) save.mutate(draft);
                }}
              >
                {t("save")}
              </Button>
            </>
          ) : null
        }
      />

      {touched && invalid ? <Callout tone="danger" title={t("errors.summary")} live /> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card padding="lg">
          <Tabs label={t("localesLabel")} items={LOCALES.map(localeTab)} defaultValue="th" />
        </Card>

        <div className="flex flex-col gap-4">
          <Card padding="md">
            <CardHeader>
              <CardTitle>{t("publishing")}</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-3">
              <Field label={t("status")}>
                <SearchableSelect
                  value={draft.status}
                  onValueChange={(status) => update({ status })}
                  options={(["draft", "published", "archived"] as const).map((value) => ({
                    value,
                    label: t(`statuses.${value}`),
                  }))}
                />
              </Field>
              <Field
                label={t("slug")}
                hint={t("slugHint")}
                required
                requiredLabel={tCommon("state.required")}
                error={touched ? errors.slug : undefined}
              >
                <Input
                  className="font-mono"
                  value={draft.slug}
                  onChange={(event) => update({ slug: event.target.value })}
                />
              </Field>
              <Field label={t("cover")} hint={t("coverHint")}>
                <FileField
                  value={draft.coverFileId}
                  onChange={(value) => update({ coverFileId: String(value ?? "") })}
                />
              </Field>
              <Field label={t("seoPage")} hint={t("seoPageHint")}>
                <SearchableSelect
                  value={draft.seoPageId || NONE}
                  onValueChange={(seoPageId) => update({ seoPageId })}
                  options={[{ value: NONE, label: t("none") }, ...(refs.options["seo-pages"] ?? [])]}
                />
              </Field>
            </div>
          </Card>
          <Card padding="md">
            <CardHeader>
              <CardTitle>{t("categories")}</CardTitle>
            </CardHeader>
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">{t("categories")}</legend>
              {(refs.options["article-categories"] ?? []).map((option) => (
                <Checkbox
                  key={option.value}
                  label={option.label}
                  checked={draft.categoryIds.includes(option.value)}
                  onCheckedChange={(checked) =>
                    update({
                      categoryIds: checked
                        ? [...draft.categoryIds, option.value]
                        : draft.categoryIds.filter((id) => id !== option.value),
                    })
                  }
                />
              ))}
            </fieldset>
          </Card>
        </div>
      </div>

      {articleId ? (
        <ConfirmAction
          open={removing}
          onOpenChange={setRemoving}
          title={t("deleteTitle")}
          description={t("deleteBody", { title: draft.titleTh || draft.slug })}
          confirmLabel={t("delete")}
          tone="destructive"
          confirmationPhrase={draft.slug}
          onConfirm={async () => {
            try {
              await deleteRow(adminBrowserApis().contract, def.path, articleId);
              toast.success(t("deleted"));
              void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", listFor(def).key) });
              router.replace("/cms/articles");
            } catch (error) {
              toast.error(problemMessage(error, t("deleteFailed")));
              throw error;
            }
          }}
        />
      ) : null}
    </div>
  );
}
