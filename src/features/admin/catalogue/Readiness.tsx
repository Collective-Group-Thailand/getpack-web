"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { Skeleton } from "@/ui/components/Skeleton";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, QueryError, Section } from "../console";

type Readiness = Schemas["CatalogReadinessDto"];
type List = Schemas["ReadinessListDto"];
type Item = Schemas["ReadinessItemDto"];

/** Where to open one row of a list: the table searched by its key, or the style's own page. */
type Open = (item: Item) => string;

const openProduct: Open = (item) => `/catalogue/catalog-products?q=${encodeURIComponent(item.key)}`;
const openStock: Open = (item) => `/catalogue/stock-products?q=${encodeURIComponent(item.key)}`;
const openStyle: Open = (item) => `/style-library/${item.id}`;

/**
 * What the catalogue still needs, as lists to work through (product owner, 2026-10-17: "บอกว่า
 * สินค้า/แบบกล่องไหนยังเป็นภาพอ้างอิง ยังไม่มีราคา หรือยังไม่เผยแพร่ เพื่อให้ทีมไล่เก็บงานได้เป็นรายการ").
 * One read (`admin.catalogReadiness.get`); each list shows its count and opens its rows where they
 * are edited. The product types lead, because the switch to instant pricing (A-16) is what turns
 * "ขอราคา" into "ใส่ตะกร้า" for every product of the type at once.
 */
export function Readiness() {
  const t = useTranslations("catalogue.readiness");
  const query = useQuery({
    queryKey: queryKeys.resource("admin", "catalog_readiness"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/catalog/readiness")).data!,
    staleTime: 60_000,
  });
  if (query.isPending)
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const data: Readiness = query.data;

  return (
    <div className="flex flex-col gap-6">
      <ProductTypes types={data.productTypes} />
      <Group
        title={t("products.title")}
        total={data.products.total}
        icon="box"
        lists={[
          { key: "referenceOnly", list: data.products.referenceOnly, open: openProduct, tone: "warning" },
          { key: "noImage", list: data.products.noImage, open: openProduct, tone: "danger" },
          { key: "quoteOnly", list: data.products.quoteOnly, open: openProduct, tone: "info" },
          { key: "notActive", list: data.products.notActive, open: openProduct, tone: "neutral" },
        ]}
      />
      <Group
        title={t("stock.title")}
        total={data.stock.total}
        icon="warehouse"
        lists={[
          { key: "referenceOnly", list: data.stock.referenceOnly, open: openStock, tone: "warning" },
          { key: "noImage", list: data.stock.noImage, open: openStock, tone: "danger" },
          { key: "quoteOnly", list: data.stock.quoteOnly, open: openStock, tone: "info" },
          { key: "notActive", list: data.stock.notActive, open: openStock, tone: "neutral" },
        ]}
      />
      <Group
        title={t("styles.title")}
        total={data.styles.total}
        icon="layers"
        lists={[
          { key: "referenceOnly", list: data.styles.referenceOnly, open: openStyle, tone: "warning" },
          { key: "noPhoto", list: data.styles.noPhoto, open: openStyle, tone: "danger" },
          { key: "notPublishable", list: data.styles.notPublishable, open: openStyle, tone: "info" },
          { key: "hidden", list: data.styles.hidden, open: openStyle, tone: "neutral" },
        ]}
      />
    </div>
  );
}

/** The product types: which price instantly, which could (calculator shipped) but still ask for a quote. */
function ProductTypes({ types }: { types: Readiness["productTypes"] }) {
  const t = useTranslations("catalogue.readiness");
  const locale = useLocale();
  const format = useFormat();
  const waiting = types.filter((type) => type.quoteMode === "rfq" && type.calculatorShipped);
  return (
    <Section
      title={t("types.title")}
      description={t("types.intro")}
      actions={
        <Button asChild size="sm" variant="secondary" iconStart="external">
          <Link href="/catalogue/product-types">{t("types.manage")}</Link>
        </Button>
      }
    >
      {waiting.length > 0 ? (
        <p className="border-info/40 bg-info-subtle mb-3 flex items-start gap-2 rounded-md border p-3 text-sm">
          <Icon name="info" size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{t("types.ready", { count: waiting.length })}</span>
        </p>
      ) : null}
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {types.map((type) => (
          <li key={type.id} className="border-border flex items-center gap-3 rounded-md border p-3 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{locale === "en" ? type.nameEn : type.nameTh}</span>
              <span className="text-muted block text-xs tabular-nums">
                {t("types.products", { count: format.number(type.activeProducts) })}
              </span>
            </span>
            {type.quoteMode === "instant" ? (
              <Badge tone="success">{t("types.instant")}</Badge>
            ) : type.calculatorShipped ? (
              <Badge tone="warning">{t("types.canSwitch")}</Badge>
            ) : (
              <Badge tone="neutral">{t("types.quoteOnly")}</Badge>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

type Tone = "warning" | "danger" | "info" | "neutral";

function Group({
  title,
  total,
  icon,
  lists,
}: {
  title: string;
  total: number;
  icon: IconName;
  lists: { key: string; list: List; open: Open; tone: Tone }[];
}) {
  const t = useTranslations("catalogue.readiness");
  const format = useFormat();
  const [openKey, setOpenKey] = useState<string | null>(lists.find((l) => l.list.count > 0)?.key ?? null);
  const current = lists.find((l) => l.key === openKey) ?? null;
  const allDone = lists.every((l) => l.list.count === 0);
  return (
    <Section
      title={
        <>
          <Icon name={icon} size={20} aria-hidden="true" className="text-primary" />
          {title}
          <span className="text-muted text-sm font-normal tabular-nums">
            {t("total", { count: format.number(total) })}
          </span>
        </>
      }
    >
      {allDone ? (
        <p className="text-success flex items-center gap-2 text-sm">
          <Icon name="check" size={18} aria-hidden="true" />
          {t("allDone")}
        </p>
      ) : (
        <>
          <div role="tablist" aria-label={title} className="mb-3 flex flex-wrap gap-2">
            {lists.map((l) => {
              const selected = l.key === openKey;
              return (
                <button
                  key={l.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setOpenKey(l.key)}
                  className={cn(
                    "rounded-control border-border inline-flex min-h-9 items-center gap-2 border px-3 text-sm",
                    selected ? "bg-primary text-fg-inverse border-primary" : "bg-surface hover:border-primary",
                    l.list.count === 0 && !selected && "text-muted",
                  )}
                >
                  {t(`lists.${l.key}`)}
                  <span className={cn("tabular-nums", selected ? "opacity-80" : "text-muted")}>
                    {format.number(l.list.count)}
                  </span>
                </button>
              );
            })}
          </div>
          {current ? (
            <div role="tabpanel">
              <p className="text-muted mb-2 text-xs">{t(`hints.${current.key}`)}</p>
              {current.list.count === 0 ? (
                <p className="text-muted text-sm">{t("none")}</p>
              ) : (
                <Card padding="none">
                  <ul className="divide-border max-h-96 divide-y overflow-y-auto">
                    {current.list.items.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={current.open(item)}
                          className="hover:bg-bg-subtle focus-visible:ring-focus-ring flex items-center gap-3 px-3 py-2 text-sm outline-none focus-visible:ring-2"
                        >
                          <span className="text-muted w-40 shrink-0 truncate text-xs tabular-nums">{item.key}</span>
                          <ItemName item={item} />
                          <Icon
                            name="chevron-right"
                            size={16}
                            aria-hidden="true"
                            className="text-muted ms-auto shrink-0"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {current.list.count > current.list.items.length ? (
                    <p className="text-muted border-border border-t px-3 py-2 text-xs">
                      {t("more", {
                        shown: format.number(current.list.items.length),
                        count: format.number(current.list.count),
                      })}
                    </p>
                  ) : null}
                </Card>
              )}
            </div>
          ) : null}
        </>
      )}
    </Section>
  );
}

function ItemName({ item }: { item: Item }) {
  const locale = useLocale();
  return <span className="min-w-0 flex-1 truncate">{locale === "en" ? item.nameEn : item.nameTh}</span>;
}
