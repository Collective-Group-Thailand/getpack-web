"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AGENT_LEAD_STAGE } from "@/domain/status";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { LeadCard } from "./LeadCard";
import { useProblemText } from "./problem";

type Lead = Schemas["AgentLeadDto"];
type Stage = Schemas["AgentLeadStage"];
const COLUMNS: readonly Stage[] = ["new", "contacted", "quoted", "negotiating"];

/**
 * The optional board by stage (desktop only, `?layout=board`). Dragging a card to a column is an enhancement for a
 * mouse: every card keeps its "ย้ายไปขั้น…" menu, which is the way for a keyboard, a screen reader and a touch
 * screen (WCAG 2.5.7). Lost is never a drop target — it needs a reason, so it goes through the menu.
 */
export function LeadBoard({ leads }: { leads: Lead[] }) {
  const t = useTranslations("agentSales.list");
  const tStatus = useTranslations("status");
  const tStage = useTranslations("agentSales.stage");
  const problemText = useProblemText();
  const router = useRouter();
  const [over, setOver] = useState<Stage | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  const drop = async (stage: Stage, leadId: string) => {
    const lead = leads.find((candidate) => candidate.id === leadId);
    setOver(null);
    if (!lead || lead.stage === stage || stage === "won" || stage === "lost") return;
    setMoving(leadId);
    try {
      await browserApi().POST("/v1/store/agent/leads/{leadId}/actions/change-stage", {
        params: { path: { leadId } },
        body: { stage: stage as Schemas["AgentLeadStageTarget"] },
      });
      toast.success(tStage("moved", { stage: tStatus(AGENT_LEAD_STAGE[stage].labelKey) }));
      router.refresh();
    } catch (error) {
      toast.error(problemText(error));
    } finally {
      setMoving(null);
    }
  };

  return (
    <div className="grid grid-cols-4 gap-4" aria-describedby="board-hint">
      <p id="board-hint" className="sr-only">
        {t("boardHint")}
      </p>
      {COLUMNS.map((stage) => {
        const inColumn = leads.filter((lead) => lead.stage === stage);
        const meta = AGENT_LEAD_STAGE[stage];
        return (
          <section
            key={stage}
            aria-labelledby={`col-${stage}`}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes("text/x-getpack-lead")) return;
              event.preventDefault();
              setOver(stage);
            }}
            onDragLeave={() => setOver((current) => (current === stage ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              void drop(stage, event.dataTransfer.getData("text/x-getpack-lead"));
            }}
            className={cn(
              "bg-surface-subtle rounded-card flex min-h-64 flex-col gap-3 border border-transparent p-3 transition-colors duration-150 motion-reduce:transition-none",
              over === stage && "border-primary/40 bg-primary-subtle",
            )}
          >
            <h2 id={`col-${stage}`} className="flex items-center justify-between gap-2 px-1 text-sm font-semibold">
              <span className="inline-flex items-center gap-2">
                <Icon name={meta.icon} size={16} aria-hidden="true" className="text-muted" />
                {tStatus(meta.labelKey)}
              </span>
              <span className="text-muted tabular-nums">{inColumn.length}</span>
            </h2>
            {inColumn.length === 0 ? (
              <p className="text-muted border-border rounded-lg border border-dashed px-3 py-6 text-center text-xs">
                {t("boardEmpty")}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {inColumn.map((lead) => (
                  <li key={lead.id} className={cn(moving === lead.id && "opacity-60")}>
                    <LeadCard lead={lead} draggable />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
