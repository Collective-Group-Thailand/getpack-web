"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { StyleCard, StyleListQuery } from "@/features/customer/catalog/api.server";
import { Button } from "@/ui/components/Button";
import { VirtualGrid } from "@/ui/components/VirtualGrid";

const StyleCardView = dynamic(() => import("./StyleCardView"));

type Item = { code: string; node: React.ReactNode } | { code: string; style: StyleCard };

export interface StyleResultsProps {
  /** The first page's cards, rendered on the server. */
  initial: { code: string; node: React.ReactNode }[];
  nextCursor: string | null;
  /** The query the first page was read with; later pages continue it by cursor. */
  query: StyleListQuery;
  /** Every match, when known — "แสดง 24 จาก 122 แบบ" and its bar. */
  total: number | null;
  signedIn: boolean;
  signInHref: string;
}

/**
 * The library's results (styles redesign §4, §14): a virtualised grid of cards at least 228 px
 * wide (two columns on a phone) that grows 24 at a time by the API's cursor, with how many of how
 * many are shown. The first page arrives as cards the server rendered, so the browser runs only
 * the grid and each card's islands; the card renderer and the API client load with "โหลดเพิ่ม".
 */
export function StyleResults({ initial, nextCursor, query, total, signedIn, signInHref }: StyleResultsProps) {
  const t = useTranslations("styles.library");
  const [items, setItems] = useState<Item[]>(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [loading, setLoading] = useState(false);

  const more = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const { browserApi } = await import("@/lib/api/browser");
      const { data } = await browserApi().GET("/v1/store/styles", { params: { query: { ...query, cursor } } });
      if (data) {
        setItems((current) => [
          ...current,
          ...data.data
            .filter((s) => !current.some((c) => c.code === s.code))
            .map((style) => ({ code: style.code, style })),
        ]);
        setCursor(data.meta.nextCursor);
      }
    } finally {
      setLoading(false);
    }
  };

  const shown = items.length;
  return (
    <div className="flex flex-col gap-6" data-quickview-scope="">
      <VirtualGrid
        items={items}
        itemKey={(item) => item.code}
        label={t("grid")}
        minColumnWidth={228}
        minColumns={2}
        gap={16}
        estimatedRowHeight={420}
        initialItems={12}
        renderItem={(item) =>
          "node" in item ? item.node : <StyleCardView style={item.style} signedIn={signedIn} signInHref={signInHref} />
        }
      />
      <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-3">
        <p className="text-muted text-sm tabular-nums" aria-live="polite">
          {total !== null ? t("shown", { shown, total }) : t("shownSome", { shown })}
        </p>
        {total ? (
          <div aria-hidden="true" className="bg-bg-subtle h-1 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full"
              style={{ width: `${Math.min(100, Math.round((shown / total) * 100))}%` }}
            />
          </div>
        ) : null}
        {cursor ? (
          <Button variant="secondary" loading={loading} onClick={more}>
            {loading ? t("loading") : t("loadMore")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
