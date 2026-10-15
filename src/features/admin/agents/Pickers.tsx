"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";
import { Combobox, type ComboboxOption } from "@/ui/components/Combobox";

import { adminBrowserApis, useStaffDirectory } from "../console";

export type PickerKind = "agent" | "customer" | "company" | "factory" | "staff";

const MIN_QUERY = 2;

/** One page of matches for what was typed, as combobox options. */
async function search(kind: Exclude<PickerKind, "staff">, q: string): Promise<ComboboxOption[]> {
  const { contract } = adminBrowserApis();
  const query = { q, perPage: 10 };
  switch (kind) {
    case "agent": {
      const { data } = await contract.GET("/v1/admin/agents", { params: { query: { ...query, status: "active" } } });
      return data!.data.map((row) => ({ value: row.id, label: row.legalName, description: row.code }));
    }
    case "customer": {
      const { data } = await contract.GET("/v1/admin/customers", { params: { query } });
      return data!.data.map((row) => ({
        value: row.id,
        label: row.displayName,
        description: [row.customerCode, row.phone, row.email].filter(Boolean).join(" · "),
      }));
    }
    case "company": {
      const { data } = await contract.GET("/v1/admin/companies", { params: { query } });
      return data!.data.map((row) => ({
        value: row.id,
        label: row.tradeName ?? row.legalName,
        description: [row.companyCode, row.taxId].filter(Boolean).join(" · "),
      }));
    }
    case "factory": {
      const { data } = await contract.GET("/v1/admin/factories", { params: { query } });
      return data!.data.map((row) => ({
        value: row.id,
        label: row.tradeName ?? row.legalName,
        description: `${row.code} · ${row.status}`,
      }));
    }
  }
}

/**
 * Choosing one record by typing part of its name, code, phone or tax id: an agent, a customer, a
 * company, a factory, or a staff member. The API searches; nothing is loaded until two characters.
 */
export function RecordPicker({
  kind,
  value,
  onValueChange,
  permission,
  "aria-label": ariaLabel,
}: {
  kind: PickerKind;
  value: ComboboxOption | null;
  onValueChange: (option: ComboboxOption | null) => void;
  /** Staff only: limit to people who hold this permission. */
  permission?: string;
  "aria-label"?: string;
}) {
  const t = useTranslations("agents.picker");
  const [query, setQuery] = useState("");
  // What the API is asked for trails the typing by a beat, so each keystroke is not a request.
  const [typed, setTyped] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const type = (next: string) => {
    setQuery(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setTyped(next.trim()), 250);
  };
  const records = useQuery({
    queryKey: queryKeys.list("admin", `agentPicker.${kind}`, { q: typed }),
    queryFn: () => search(kind as Exclude<PickerKind, "staff">, typed),
    enabled: kind !== "staff" && typed.length >= MIN_QUERY,
    staleTime: STALE_TIME.reference,
  });
  const staff = useStaffDirectory({ q: kind === "staff" ? typed : "", permission, limit: 10 });
  const options =
    kind === "staff"
      ? (staff.data ?? []).map((person) => ({ value: person.id, label: person.displayName }))
      : typed.length >= MIN_QUERY
        ? (records.data ?? [])
        : [];
  return (
    <Combobox
      value={value}
      onValueChange={onValueChange}
      query={query}
      onQueryChange={type}
      options={options}
      loading={kind === "staff" ? staff.isFetching : records.isFetching}
      placeholder={t(`placeholder.${kind}`)}
      aria-label={ariaLabel}
      labels={{
        loading: t("loading"),
        empty: typed.length >= MIN_QUERY ? t("empty") : t("typeMore"),
        clear: t("clear"),
      }}
    />
  );
}
