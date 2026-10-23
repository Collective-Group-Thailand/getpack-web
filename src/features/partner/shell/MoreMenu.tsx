"use client";

import { useState } from "react";

import { Row, RowList } from "@/features/partner/rows";
import { Input } from "@/ui/components/Input";
import type { IconName } from "@/ui/icons";

export type MoreGroup = {
  key: string;
  title: string;
  items: { key: string; href: string; icon: IconName; title: string; meta?: string }[];
};

/** The phone's full menu with a filter on top — about fifty entries for an owner. */
export function MoreMenu({
  groups,
  label,
  placeholder,
  empty,
}: {
  groups: MoreGroup[];
  label: string;
  placeholder: string;
  empty: string;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase();
  const shown = groups
    .map((group) => ({
      ...group,
      items: needle
        ? group.items.filter((item) =>
            `${item.title} ${item.meta ?? ""} ${group.title}`.toLocaleLowerCase().includes(needle),
          )
        : group.items,
    }))
    .filter((group) => group.items.length > 0);
  return (
    <>
      <Input
        type="search"
        inputSize="lg"
        aria-label={label}
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {shown.length === 0 ? <p className="text-muted">{empty}</p> : null}
      {shown.map((group) => (
        <section key={group.key} aria-labelledby={`more-${group.key}`} className="flex flex-col gap-2">
          <h2 id={`more-${group.key}`} className="text-muted text-sm font-semibold">
            {group.title}
          </h2>
          <RowList>
            {group.items.map((item) => (
              <Row key={item.key} href={item.href} icon={item.icon} title={item.title} meta={item.meta} />
            ))}
          </RowList>
        </section>
      ))}
    </>
  );
}
