import { redirect } from "next/navigation";

import { onRecordsPath, requireAgentZone } from "@/features/agent/context.server";
import { NotAgent } from "@/features/agent/NotAgent";
import { InstallPrompt } from "@/features/agent/pwa/InstallPrompt";
import { AgentShell } from "@/features/agent/shell";
import { AGENT_ZONE_PATHS } from "@/features/shared/agent/zone-paths";
import { currentPath } from "@/features/shared/auth/guard";

/**
 * Every getpack Agent page needs a session and sits in the agent shell (D-467). Who sees what is decided once, here:
 * an agent gets the app; an ended agent the statements and 50 ทวิ only (and the profile, to sign out); a signed-in
 * customer who is not an agent one short screen pointing to getpack.co/agent. Each page still asks for what it needs
 * (`requireActiveAgent` / `requireAgentRecords`), since a page renders beside its layout, not after it.
 */
export default async function AgentAppLayout({ children }: { children: React.ReactNode }) {
  const state = await requireAgentZone();
  const name = state.actor.displayName;

  if (state.kind === "not-agent") {
    return (
      <AgentShell mode="bare" name={name} code={null}>
        <NotAgent programme={state.programme} />
      </AgentShell>
    );
  }

  if (state.kind === "ended") {
    if (!(await onRecordsPath()) && (await currentPath()) !== AGENT_ZONE_PATHS.profile) {
      redirect(AGENT_ZONE_PATHS.statements);
    }
    return (
      <AgentShell mode="ended" name={name} code={null}>
        {children}
      </AgentShell>
    );
  }

  return (
    <AgentShell mode="agent" name={name} code={state.agent.code}>
      {children}
      <InstallPrompt />
    </AgentShell>
  );
}
