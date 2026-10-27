"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { trackCatalog } from "@/lib/analytics/catalog";
import type { QuickViewProps } from "./QuickView";
import { readParams, toSearch } from "./query";

const QuickView = dynamic(() => import("./QuickView"), { ssr: false });

const urlWith = (style: string | undefined) => {
  const params = readParams(Object.fromEntries(new URLSearchParams(window.location.search)));
  const search = toSearch({ ...params, style });
  return `${window.location.pathname}${search ? `?${search}` : ""}`;
};

/**
 * Opens a library card in the quick view instead of leaving the page (styles redesign §8).
 *
 * A card's name stays a real link to the style's own page — what a crawler follows, what a
 * middle-click or ⌘-click opens — and a plain click on it inside `[data-quickview-scope]` opens
 * the panel and adds `style=PK-…` to the URL with the History API (Next keeps `useSearchParams`
 * in step, and nothing is fetched from the server for it). Back closes the panel; so does Escape,
 * returning focus to the card. A shared link with `style=` opens it on arrival.
 */
export function QuickViewHost(props: Omit<QuickViewProps, "code" | "onClose">) {
  const search = useSearchParams();
  const code = search.get("style")?.toUpperCase() ?? null;
  const size = readParams({ size: search.get("size") ?? undefined }).size;
  const pushed = useRef(false);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[data-style-code]");
      if (!link || !link.closest("[data-quickview-scope]")) return;
      const styleCode = link.dataset.styleCode!;
      // Before the link's own handler (capture phase): it would navigate on its own otherwise.
      event.preventDefault();
      event.stopPropagation();
      opener.current = link;
      pushed.current = true;
      const cell = link.closest<HTMLElement>("[aria-posinset]");
      trackCatalog("catalog_quickview", {
        style_code: styleCode,
        position: cell ? Number(cell.getAttribute("aria-posinset")) : undefined,
        source: "grid",
      });
      window.history.pushState(null, "", urlWith(styleCode));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!code) return null;
  return (
    <QuickView
      {...props}
      code={code}
      size={size}
      onClose={() => {
        if (pushed.current) {
          pushed.current = false;
          window.history.back();
        } else {
          window.history.replaceState(null, "", urlWith(undefined));
        }
        // Radix returns focus to what had it; a card re-rendered since may need it by hand.
        const back = opener.current;
        if (back) requestAnimationFrame(() => back.isConnected && back.focus());
      }}
    />
  );
}
