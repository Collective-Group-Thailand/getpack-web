import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getMyApplication, getMySessions, type MySession } from "@/features/agent/api.server";
import { AgentPage, Panel } from "@/features/agent/AgentPage";
import { requireAgentZone } from "@/features/agent/context.server";
import { SignOutOtherAgentDevices } from "@/features/agent/profile/AgentSessions";
import { AGENT_STATUS } from "@/domain/status";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Badge } from "@/ui/components/Badge";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agentZone.profile");
  return { title: t("title") };
}

/**
 * โปรไฟล์และสัญญา (D-467): who the agent is to getpack — code, plan, since when — the agreement version they accepted,
 * and where they are signed in, per surface, with a way to sign getpack Agent out everywhere else. An ended agent
 * sees the sign-ins only.
 */
export default async function Page() {
  const state = await requireAgentZone();
  const [t, format, sessions, application] = await Promise.all([
    getTranslations("agentZone.profile"),
    getFormat(),
    getMySessions(),
    state.kind === "agent" ? getMyApplication() : Promise.resolve(null),
  ]);
  const agentSessions = sessions.filter((session) => session.client === "agent");
  const otherAgentDevices = agentSessions.filter((session) => !session.current).length;

  return (
    <AgentPage title={t("title")} intro={t("intro")}>
      {state.kind === "agent" ? (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Panel
            id="profile-agent"
            title={t("agentTitle")}
            action={<StatusChip map={AGENT_STATUS} value={state.agent.status} />}
          >
            <DescriptionList
              items={[
                { term: t("code"), description: <span className="font-semibold tracking-wide tabular-nums">{state.agent.code}</span> },
                { term: t("legalName"), description: state.agent.legalName },
                { term: t("kind"), description: t(`kinds.${state.agent.kind}`) },
                { term: t("plan"), description: state.agent.plan.nameTh },
                { term: t("joinedAt"), description: format.date(state.agent.joinedAt) },
                { term: t("link"), description: <span className="break-all">{state.agent.link}</span>, wide: true },
              ]}
            />
          </Panel>
          <Panel id="profile-agreement" title={t("agreementTitle")}>
            {application?.agreementVersionNo ? (
              <DescriptionList
                items={[
                  { term: t("agreementVersion"), description: t("version", { n: application.agreementVersionNo }) },
                  { term: t("agreementAcceptedAt"), description: format.dateTime(application.agreementAcceptedAt) },
                  ...(state.programme.agreement
                    ? [{ term: t("agreementInForce"), description: t("version", { n: state.programme.agreement.versionNo }) }]
                    : []),
                ]}
              />
            ) : (
              <p className="text-muted text-sm">{t("agreementNone")}</p>
            )}
            <p className="text-muted mt-3 text-sm">{t("agreementHint")}</p>
          </Panel>
        </div>
      ) : null}

      <Panel
        id="profile-sessions"
        title={t("sessions.title")}
        action={<SignOutOtherAgentDevices others={otherAgentDevices} />}
      >
        <p className="text-muted mb-3 text-sm">{t("sessions.intro")}</p>
        {sessions.length === 0 ? (
          <p className="text-muted text-sm">{t("sessions.none")}</p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-lg border">
            {sessions.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </ul>
        )}
      </Panel>
    </AgentPage>
  );
}

async function SessionRow({ session }: { session: MySession }) {
  const [t, format] = await Promise.all([getTranslations("agentZone.profile.sessions"), getFormat()]);
  return (
    <li className="flex items-start gap-3 px-3 py-3 sm:px-4">
      <span className="bg-bg-subtle text-muted grid size-10 shrink-0 place-items-center rounded-full">
        <Icon name={session.client === "agent" ? "smartphone" : "shopping-bag"} size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {t(`clients.${session.client}`)}
          {session.current ? <Badge size="sm">{t("current")}</Badge> : null}
        </p>
        <p className="text-muted text-sm">
          {t(`methods.${session.loginMethod}`)} · {t("signedIn", { date: format.date(session.signedInAt) })} ·{" "}
          {t("lastActive", { when: format.dateTime(session.lastActiveAt) })}
        </p>
        {session.userAgent ? (
          <p className="text-muted truncate text-xs" title={session.userAgent}>
            {session.userAgent}
          </p>
        ) : null}
      </div>
    </li>
  );
}
