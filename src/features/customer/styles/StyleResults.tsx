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
  signedIn: boolean;
  signInHref: string;
}

/**
 * The library's results (U3.5 §1, §4): a virtualised grid that grows a page at a time by the
 * API's cursor. The first page arrives as cards the server rendered, so the browser runs only the
 * grid and each card's save / compare island; the card renderer and the API client load with the
 * first "show more".
 */
export function StyleResults({ initial, nextCursor, query, signedIn, signInHref }: StyleResultsProps) {
  const t = useTranslations("styles.list");
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

  return (
    <div className="flex flex-col gap-6">
      <VirtualGrid
        items={items}
        itemKey={(item) => item.code}
        label={t("grid")}
        minColumnWidth={230}
        estimatedRowHeight={330}
        initialItems={12}
        renderItem={(item) =>
          "node" in item ? item.node : <StyleCardView style={item.style} signedIn={signedIn} signInHref={signInHref} />
        }
      />
      <div className="flex flex-col items-center gap-2">
        <p className="text-muted text-sm" aria-live="polite">
          {t("shownMore", { shown: items.length })}
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
