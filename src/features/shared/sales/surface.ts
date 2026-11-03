import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";

/**
 * Where the shared lead components (D-468 pipeline, D-469 staff pipeline) run: the agent zone (a freelance or
 * employee agent's own leads over `/v1/store/agent/*`) or the admin zone's sales desk (`/v1/admin/sales/*`, staff
 * bearer). The same stage rules, menus, dialogs and timeline; only the endpoint and the links differ. A plain string
 * so a Server Component can pass it.
 */
export type LeadSurface = "agent" | "admin";

type ChangeStage = Schemas["ChangeAgentLeadStageDto"];

export interface LeadSurfaceBinding {
  changeStage: (leadId: string, body: ChangeStage) => Promise<unknown>;
  leadHref: (leadId: string) => string;
  quoteHref: (agentQuoteId: string) => string;
}

export const LEAD_SURFACES: Record<LeadSurface, LeadSurfaceBinding> = {
  agent: {
    changeStage: (leadId, body) =>
      browserApi().POST("/v1/store/agent/leads/{leadId}/actions/change-stage", { params: { path: { leadId } }, body }),
    leadHref: (leadId) => `/leads/${leadId}`,
    quoteHref: (agentQuoteId) => `/quotes/${agentQuoteId}`,
  },
  admin: {
    changeStage: (leadId, body) =>
      browserApi().POST("/v1/admin/sales/leads/{leadId}/actions/change-stage", { params: { path: { leadId } }, body }),
    leadHref: (leadId) => `/sales/leads/${leadId}`,
    quoteHref: (agentQuoteId) => `/sales/quotes?quote=${agentQuoteId}`,
  },
};
