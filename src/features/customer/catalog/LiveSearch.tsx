"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { SearchInput } from "@/ui/components/SearchInput";

/**
 * The catalogue's search box: one field with its icon, searching as you type (UX audit,
 * `/products`: "search เป็น input เดียวมีไอคอน ค้นขณะพิมพ์"). It sits inside a plain GET form, so
 * Enter — and a browser without JavaScript — still submits it; typing replaces the URL after a
 * pause, so the result stays shareable and the back button is not filled with keystrokes.
 */
export function LiveSearch({
  action,
  q,
  label,
  placeholder,
  clearLabel,
}: {
  action: string;
  q?: string;
  label: string;
  placeholder: string;
  clearLabel: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(q ?? "");
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current) return;
    const term = value.trim();
    const timer = setTimeout(() => {
      router.replace(term ? `${action}?q=${encodeURIComponent(term)}` : action, { scroll: false });
    }, 400);
    return () => clearTimeout(timer);
  }, [value, action, router]);

  return (
    <SearchInput
      name="q"
      aria-label={label}
      placeholder={placeholder}
      clearLabel={clearLabel}
      value={value}
      onValueChange={(next) => {
        typed.current = true;
        setValue(next);
      }}
      className="w-full"
    />
  );
}
