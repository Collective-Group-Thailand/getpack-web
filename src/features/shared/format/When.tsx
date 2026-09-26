"use client";

import { TimeText } from "@/ui/components/TimeText";

import { useFormat } from "./useFormat";

/**
 * "5 นาทีที่แล้ว", with the absolute Bangkok time a hover or focus away — the one way the back
 * office shows when something happened (design-system.md §4).
 */
export function When({ at, absoluteOnly = false }: { at: string | null | undefined; absoluteOnly?: boolean }) {
  const format = useFormat();
  if (!at) return <span className="text-muted">{"—"}</span>;
  const absolute = format.dateTime(at);
  if (absoluteOnly) return <time dateTime={at}>{absolute}</time>;
  return (
    <TimeText dateTime={at} absolute={absolute}>
      {format.relative(at)}
    </TimeText>
  );
}
