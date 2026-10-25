"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";
import { Kbd } from "@/ui/components/Kbd";
import { Spinner } from "@/ui/components/Spinner";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { listHref, type ListParams } from "./query";

/** How long typing rests before the results follow (styles redesign §7: 160 ms). */
const DEBOUNCE_MS = 160;

/**
 * The library's search (styles redesign §2): results follow the words as they are typed — no
 * button — through `router.replace`, so the server renders them and Back does not step through
 * every letter. "/" focuses it from anywhere on the page. "ค้นหาบ่อย" are staff's terms
 * (`store.style-library.settings`), hidden when there are none.
 *
 * Without JavaScript it is a plain GET form to the same URL.
 */
export function LibrarySearch({
  params,
  action,
  quickTerms,
}: {
  params: ListParams;
  /** The list's path in this locale — the form's target without JavaScript. */
  action: string;
  quickTerms: { label: string; query: string }[];
}) {
  const t = useTranslations("styles.library");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(params.q ?? "");
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // A change of the URL from elsewhere (a chip removed, Back) is the box's new text — unless the
  // customer is typing in it.
  const [synced, setSynced] = useState(params.q ?? "");
  const [typing, setTyping] = useState(false);
  if ((params.q ?? "") !== synced) {
    setSynced(params.q ?? "");
    if (!typing) setValue(params.q ?? "");
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const search = (q: string) => {
    clearTimeout(timer.current);
    const words = q.trim();
    if (words === (params.q ?? "")) return;
    startTransition(() => {
      // A new search starts from the top and drops an open quick view; the filters stay.
      router.replace(listHref({ ...params, q: words || undefined, style: undefined, sort: undefined }), {
        scroll: false,
      });
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <form
        role="search"
        action={action}
        onSubmit={(event) => {
          event.preventDefault();
          search(value);
        }}
        className="relative"
      >
        <label htmlFor="styles-q" className="sr-only">
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
          id="styles-q"
          name="q"
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          value={value}
          placeholder={t("searchPlaceholder")}
          aria-describedby="styles-q-shortcut"
          onFocus={() => setTyping(true)}
          onBlur={() => setTyping(false)}
          onChange={(event) => {
            setValue(event.target.value);
            clearTimeout(timer.current);
            const next = event.target.value;
            timer.current = setTimeout(() => search(next), DEBOUNCE_MS);
          }}
          className={cn(
            "border-border bg-surface text-fg placeholder:text-subtle rounded-card h-14 w-full border ps-12 pe-14 text-base shadow-sm outline-none",
            "focus-visible:border-primary focus-visible:ring-focus-ring focus-visible:ring-2",
            "[&::-webkit-search-cancel-button]:hidden",
          )}
        />
        <span className="absolute end-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          {pending ? <Spinner size={16} label={t("loading")} /> : null}
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
          ) : (
            <span id="styles-q-shortcut" className="hidden md:inline">
              <span className="sr-only">{t("searchShortcut")}</span>
              <Kbd aria-hidden="true">/</Kbd>
            </span>
          )}
        </span>
      </form>
      {quickTerms.length ? (
        <p className="text-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span>{t("quickSearch")}</span>
          {quickTerms.map((term) => (
            <button
              key={term.query}
              type="button"
              onClick={() => {
                setValue(term.query);
                search(term.query);
              }}
              className="text-fg focus-visible:ring-focus-ring hover:text-primary rounded-sm underline underline-offset-2 outline-none focus-visible:ring-2"
            >
              {term.label}
            </button>
          ))}
        </p>
      ) : null}
    </div>
  );
}
