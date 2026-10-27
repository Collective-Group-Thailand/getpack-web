"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";
import { Spinner } from "@/ui/components/Spinner";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { hubHref, type HubParams } from "./query";

/** How long typing rests before the list follows (prompt item 1: ~250 ms). */
export const SEARCH_DEBOUNCE_MS = 250;

/**
 * The hub's product search (prompt item 1): the list follows the words as they are typed, through
 * `router.replace` (the server renders the result; Back does not step through every letter), and the
 * page scrolls to the catalogue once there is something to show. Without JavaScript it is a GET form.
 */
export function HubSearch({ params, base, action }: { params: HubParams; base: string; action: string }) {
  const t = useTranslations("products.head");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(params.q ?? "");
  const [typing, setTyping] = useState(false);
  const [synced, setSynced] = useState(params.q ?? "");
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The URL changed from elsewhere (Back, "ดูสินค้าทั้งหมด"): show its words, unless someone is typing.
  if ((params.q ?? "") !== synced) {
    setSynced(params.q ?? "");
    if (!typing) setValue(params.q ?? "");
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  const search = (text: string) => {
    clearTimeout(timer.current);
    const words = text.trim();
    if (words === (params.q ?? "")) return;
    startTransition(() => {
      router.replace(hubHref(base, params, { q: words || null }), { scroll: false });
    });
    if (words) {
      const target = document.getElementById("catalog");
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  };

  return (
    <form
      role="search"
      action={action}
      onSubmit={(event) => {
        event.preventDefault();
        search(value);
      }}
      className="relative"
    >
      <label htmlFor="products-q" className="sr-only">
        {t("searchLabel")}
      </label>
      <Icon
        name="search"
        size={20}
        aria-hidden="true"
        className="text-muted pointer-events-none absolute start-4 top-1/2 -translate-y-1/2"
      />
      <input
        ref={input}
        id="products-q"
        name="q"
        type="search"
        autoComplete="off"
        enterKeyHint="search"
        value={value}
        placeholder={t("searchPlaceholder")}
        onFocus={() => setTyping(true)}
        onBlur={() => setTyping(false)}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => search(next), SEARCH_DEBOUNCE_MS);
        }}
        className={cn(
          "border-border bg-surface text-fg placeholder:text-subtle rounded-card h-13.5 w-full border ps-12 pe-12 text-base shadow-sm outline-none",
          "focus-visible:border-primary focus-visible:ring-focus-ring focus-visible:ring-2",
          "[&::-webkit-search-cancel-button]:hidden",
        )}
      />
      <span className="absolute end-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
        {pending ? <Spinner size={16} label={t("searchLabel")} /> : null}
        {value ? (
          <button
            type="button"
            aria-label={t("searchClear")}
            onClick={() => {
              setValue("");
              search("");
              input.current?.focus();
            }}
            className="text-muted hover:text-fg focus-visible:ring-focus-ring grid size-8 place-items-center rounded-md outline-none focus-visible:ring-2"
          >
            <Icon name="close" size={16} aria-hidden="true" />
          </button>
        ) : null}
      </span>
    </form>
  );
}
