"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Input } from "@/ui/components/Input";
import { Kbd } from "@/ui/components/Kbd";
import { Spinner } from "@/ui/components/Spinner";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { trackCatalog } from "@/lib/analytics/catalog";

import { listHref, type ListParams } from "./query";
import { cmOfSize, sizeOfCm } from "./size";

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
  sizeSearch = false,
  wizard,
}: {
  params: ListParams;
  /** The list's path in this locale — the form's target without JavaScript. */
  action: string;
  quickTerms: { label: string; query: string }[];
  /** "ค้นหาด้วยขนาดสินค้า" (C0): only when the API has styles with a fit range (`meta.sizeSearchStyles`). */
  sizeSearch?: boolean;
  /** "ช่วยเลือกให้หน่อย" (C0, behind its flag): the wizard's trigger, beside the tabs. */
  wizard?: React.ReactNode;
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

  const [method, setMethod] = useState<"word" | "size">(params.size && sizeSearch ? "size" : "word");
  const sizeCm = cmOfSize(params.size);
  const [dims, setDims] = useState({ w: sizeCm?.w ?? "", l: sizeCm?.l ?? "", h: sizeCm?.h ?? "" });
  const findBySize = () => {
    const size = sizeOfCm(dims);
    if (!size) return;
    trackCatalog("catalog_search", { query: size, mode: "size", result_count: -1 });
    startTransition(() => {
      router.replace(listHref({ ...params, size, style: undefined }), { scroll: false });
    });
  };
  const tabClass = (on: boolean) =>
    cn(
      "focus-visible:ring-focus-ring rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-2",
      on ? "bg-surface text-fg ring-border shadow-sm ring-1" : "text-muted hover:text-fg",
    );

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
    <div className="flex min-w-0 flex-col">
      {/* The method tabs (prototype `.stabs`): by word always; by size only with fit data (C0). */}
      <div className="mb-2.5 flex flex-wrap items-center gap-1">
        <div role="tablist" aria-label={t("searchMethods")} className="flex gap-1">
          <button
            type="button"
            role="tab"
            id="styles-tab-word"
            aria-selected={method === "word"}
            aria-controls="styles-pane-word"
            onClick={() => setMethod("word")}
            className={tabClass(method === "word")}
          >
            {t("searchTabWord")}
          </button>
          {sizeSearch ? (
            <button
              type="button"
              role="tab"
              id="styles-tab-size"
              aria-selected={method === "size"}
              aria-controls="styles-pane-size"
              onClick={() => setMethod("size")}
              className={tabClass(method === "size")}
            >
              {t("searchTabSize")}
            </button>
          ) : null}
        </div>
        {wizard ? <div className="ms-auto">{wizard}</div> : null}
      </div>
      {sizeSearch && method === "size" ? (
        <div id="styles-pane-size" role="tabpanel" aria-labelledby="styles-tab-size">
          <form
            action={action}
            onSubmit={(event) => {
              event.preventDefault();
              findBySize();
            }}
            className="border-border bg-surface rounded-card flex flex-wrap items-end gap-2 border p-2.5 shadow-sm"
          >
            {(["w", "l", "h"] as const).map((key, index) => (
              <span key={key} className="flex items-end gap-2">
                {index > 0 ? (
                  <span aria-hidden="true" className="text-muted pb-2.5">
                    ×
                  </span>
                ) : null}
                <label className="text-muted flex flex-col gap-1 text-xs font-medium">
                  {t(key === "w" ? "sizeWidth" : key === "l" ? "sizeLength" : "sizeHeight")}
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0.1}
                    max={999.9}
                    step={0.1}
                    required
                    value={dims[key]}
                    onChange={(event) => setDims((d) => ({ ...d, [key]: event.target.value }))}
                    className="w-[4.75rem] tabular-nums"
                  />
                </label>
              </span>
            ))}
            <span className="text-muted pb-2.5 text-sm">{t("sizeUnit")}</span>
            <Button type="submit" loading={pending} className="ms-auto max-sm:w-full">
              {t("sizeSubmit")}
            </Button>
          </form>
          <p className="text-muted mt-2 text-[0.8125rem]">{t("sizeHint")}</p>
        </div>
      ) : null}
      <form
        role="search"
        id="styles-pane-word"
        aria-labelledby="styles-tab-word"
        hidden={method !== "word"}
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
            "border-border bg-surface text-fg placeholder:text-subtle rounded-card h-13.5 w-full border ps-12 pe-14 text-base shadow-sm outline-none",
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
      {quickTerms.length && method === "word" ? (
        <p className="text-muted mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[0.8125rem]">
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
