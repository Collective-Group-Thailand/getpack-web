"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { StyleVariantCard, StyleVariantListQuery } from "@/features/customer/catalog/api.server";
import { Button } from "@/ui/components/Button";
import { VirtualGrid } from "@/ui/components/VirtualGrid";

const VariantCardView = dynamic(() => import("./VariantCardView"));

type Item = { code: string; node: React.ReactNode } | { code: string; card: StyleVariantCard };

/**
 * The "every variant" grid (D-410): a virtualised grid that grows a page at a time by the API's
 * cursor — never the whole library at once. The first page arrives rendered on the server.
 */
export function VariantResults({
  initial,
  nextCursor,
  query,
  total,
}: {
  initial: { code: string; node: React.ReactNode }[];
  nextCursor: string | null;
  query: StyleVariantListQuery;
  total: number;
}) {
  const t = useTranslations("styles.list");
  const [items, setItems] = useState<Item[]>(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [loading, setLoading] = useState(false);

  const more = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const { browserApi } = await import("@/lib/api/browser");
      const { data } = await browserApi().GET("/v1/store/styles/variants", {
        params: { query: { ...query, cursor } },
      });
      if (data) {
        setItems((current) => [
          ...current,
          ...data.data
            .filter((v) => !current.some((c) => c.code === v.code))
            .map((card) => ({ code: card.code, card })),
        ]);
        setCursor(data.meta.nextCursor);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <VirtualGrid
        items={items}
        itemKey={(item) => item.code}
        label={t("variantGrid")}
        minColumnWidth={190}
        minColumns={2}
        gap={14}
        estimatedRowHeight={280}
        initialItems={12}
        renderItem={(item) => ("node" in item ? item.node : <VariantCardView card={item.card} />)}
      />
      <div className="flex flex-col items-center gap-2">
        <p className="text-muted text-sm" aria-live="polite">
          {t("shown", { shown: items.length, total })}
        </p>
        {cursor ? (
          <Button variant="secondary" loading={loading} onClick={more}>
            {loading ? t("loading") : t("loadMore")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
