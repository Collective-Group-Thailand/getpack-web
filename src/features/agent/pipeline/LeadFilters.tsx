"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AGENT_LEAD_STAGE } from "@/domain/status";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { RadioCards } from "@/ui/components/RadioCards";
import { SearchInput } from "@/ui/components/SearchInput";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Sheet } from "@/ui/components/Sheet";

type Stage = Schemas["AgentLeadStage"];
type Sort = Schemas["AgentLeadSort"];
const STAGES: readonly Stage[] = ["new", "contacted", "quoted", "negotiating", "won", "lost"];
const SORTS: readonly Sort[] = ["updatedAt", "nextFollowUpAt", "protectedUntil", "expectedValue", "createdAt"];

/**
 * The list's search and filters. A phone gets one "ตัวกรอง" button that opens a bottom sheet (thumb zone, the
 * choices as large radio cards, one "ดูผล" action); from 640 px the same choices sit inline and apply on change. The
 * URL carries every choice, so a filtered list is a link and the back button undoes it.
 */
export function LeadFilters({ boardAvailable }: { boardAvailable: boolean }) {
  const t = useTranslations("agentSales.filters");
  const tStatus = useTranslations("status");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [sheet, setSheet] = useState(false);
  const stage = (params.get("stage") ?? "") as Stage | "";
  const sort = (params.get("sort") ?? "updatedAt") as Sort;
  const layout = params.get("layout") === "board" ? "board" : "list";
  const [draftStage, setDraftStage] = useState<Stage | "all">(stage || "all");
  const [draftSort, setDraftSort] = useState<Sort>(sort);

  const go = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    next.delete("cursor");
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const stageOptions = [
    { value: "all" as const, label: t("allStages") },
    ...STAGES.map((value) => ({ value, label: tStatus(AGENT_LEAD_STAGE[value].labelKey) })),
  ];
  const sortOptions = SORTS.map((value) => ({ value, label: t(`sorts.${value}`) }));
  const active = (stage ? 1 : 0) + (sort !== "updatedAt" ? 1 : 0);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <form
        role="search"
        className="flex min-w-0 flex-1 gap-2 sm:max-w-sm"
        onSubmit={(event) => {
          event.preventDefault();
          go({ q: q.trim() || null });
        }}
      >
        <Field label={t("search")} labelHidden className="min-w-0 flex-1">
          <SearchInput
            value={q}
            onValueChange={(value) => {
              setQ(value);
              if (!value) go({ q: null });
            }}
            clearLabel={t("clear")}
            placeholder={t("searchPlaceholder")}
            enterKeyHint="search"
            className="[&_input]:min-h-11 sm:[&_input]:min-h-0"
          />
        </Field>
        <Button
          type="button"
          variant="secondary"
          iconStart="filter"
          className="min-h-11 sm:hidden"
          onClick={() => {
            setDraftStage(stage || "all");
            setDraftSort(sort);
            setSheet(true);
          }}
        >
          {t("filters")}
          {active ? <span className="text-primary tabular-nums"> {active}</span> : null}
        </Button>
      </form>

      <div className="hidden gap-3 sm:flex sm:items-end">
        <Field label={t("stage")} className="w-48">
          <NativeSelect
            value={stage || "all"}
            options={stageOptions}
            onValueChange={(value) => go({ stage: value === "all" ? null : value })}
          />
        </Field>
        <Field label={t("sort")} className="w-52">
          <NativeSelect
            value={sort}
            options={sortOptions}
            onValueChange={(value) =>
              go({ sort: value === "updatedAt" ? null : value, order: value === "expectedValue" || value === "updatedAt" || value === "createdAt" ? null : "asc" })
            }
          />
        </Field>
      </div>

      {boardAvailable ? (
        <div className="hidden lg:ms-auto lg:block">
          <SegmentedControl
            label={t("layout")}
            value={layout}
            onValueChange={(value) => go({ layout: value === "board" ? "board" : null })}
            options={[
              { value: "list", label: t("layoutList"), icon: "list-bullet" },
              { value: "board", label: t("layoutBoard"), icon: "columns" },
            ]}
          />
        </div>
      ) : null}

      <Sheet
        open={sheet}
        onOpenChange={setSheet}
        side="bottom"
        title={t("filters")}
        closeLabel={tCommon("actions.close")}
        footer={
          <>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setSheet(false);
                go({ stage: null, sort: null, order: null });
              }}
            >
              {t("reset")}
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setSheet(false);
                go({
                  stage: draftStage === "all" ? null : draftStage,
                  sort: draftSort === "updatedAt" ? null : draftSort,
                  order: ["expectedValue", "updatedAt", "createdAt"].includes(draftSort) ? null : "asc",
                });
              }}
            >
              {t("apply")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <Field label={t("stage")}>
            <RadioCards columns={2} value={draftStage} onValueChange={setDraftStage} options={stageOptions} />
          </Field>
          <Field label={t("sort")}>
            <RadioCards columns={1} value={draftSort} onValueChange={setDraftSort} options={sortOptions} />
          </Field>
        </div>
      </Sheet>
    </div>
  );
}
