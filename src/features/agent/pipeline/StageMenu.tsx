"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AGENT_LEAD_STAGE } from "@/domain/status";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { DropdownMenu, type MenuItem } from "@/ui/components/DropdownMenu";
import { toast } from "@/ui/components/Toast";

import { LostDialog } from "./LostDialog";
import { useProblemText } from "./problem";

type Stage = Schemas["AgentLeadStage"];
type Target = Schemas["AgentLeadStageTarget"];

/** The stages an agent may move a lead to (`AgentLeadStageTarget`): won is the system's, after the first payment. */
export const STAGE_TARGETS: readonly Target[] = ["new", "contacted", "quoted", "negotiating", "lost"];

/**
 * "ย้ายไปขั้น…" — the one way to change a lead's stage on every size (WCAG 2.5.7: dragging is never the only way). A
 * real menu button: Enter / Space / arrow keys, focus back on the trigger. Lost asks for the reason first.
 */
export function StageMenu({
  leadId,
  name,
  stage,
  size = "sm",
  onMoved,
}: {
  leadId: string;
  name: string;
  stage: Stage;
  size?: "sm" | "md";
  onMoved?: (stage: Stage) => void;
}) {
  const t = useTranslations("agentSales.stage");
  const tStatus = useTranslations("status");
  const problemText = useProblemText();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [lost, setLost] = useState(false);
  if (stage === "won" || stage === "lost") return null;

  const move = async (target: Target) => {
    setBusy(true);
    try {
      await browserApi().POST("/v1/store/agent/leads/{leadId}/actions/change-stage", {
        params: { path: { leadId } },
        body: { stage: target },
      });
      toast.success(t("moved", { stage: tStatus(AGENT_LEAD_STAGE[target].labelKey) }));
      onMoved?.(target);
      router.refresh();
    } catch (error) {
      toast.error(problemText(error));
    } finally {
      setBusy(false);
    }
  };

  const items: MenuItem[] = STAGE_TARGETS.filter((target) => target !== stage).map((target) => ({
    id: target,
    label: tStatus(AGENT_LEAD_STAGE[target].labelKey),
    icon: AGENT_LEAD_STAGE[target].icon,
    separatorBefore: target === "lost",
    tone: target === "lost" ? "destructive" : "default",
    onSelect: () => (target === "lost" ? setLost(true) : void move(target)),
  }));

  return (
    <>
      <DropdownMenu
        label={t("menuLabel", { name })}
        heading={t("menuHeading")}
        items={items}
        trigger={
          <Button variant="secondary" size={size} iconStart="arrow-right" loading={busy} className="min-h-11 md:min-h-0">
            {t("moveTo")}
            <span className="sr-only">{t("menuFor", { name })}</span>
          </Button>
        }
      />
      <LostDialog
        open={lost}
        onOpenChange={setLost}
        leadId={leadId}
        name={name}
        onDone={() => {
          onMoved?.("lost");
          router.refresh();
        }}
      />
    </>
  );
}
