import { getTranslations } from "next-intl/server";

import { getFormat } from "@/features/shared/format/server";
import { HeroStory, type StoryScene } from "@/features/customer/hero-story/HeroStory";
import { Foot, Pill, Pressed, Scene, Tick, Toast, Up } from "@/features/customer/hero-story/parts";
import type { Schemas } from "@/lib/api/types";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

type Programme = Schemas["PublicAgentProgrammeDto"];

/** A placeholder line where a real name would be — the story never shows a customer, amount or date of its own. */
function Line({ width = "w-2/5", className }: { width?: string; className?: string }) {
  return <span aria-hidden="true" className={cn("bg-border-strong rounded-thumb block h-2", width, className)} />;
}

const LEAD_ROWS: { width: string; stage: "new" | "contacted" | "quoted" }[] = [
  { width: "w-1/2", stage: "quoted" },
  { width: "w-2/5", stage: "contacted" },
  { width: "w-3/5", stage: "new" },
];

/**
 * The /agent hero story (the hero family of /business and /partner-with-us): share the link, follow a lead, send a
 * quote, get paid. Rates and the worked example come from the API (`store.agentProgramme.public`); names are placeholder
 * lines — no invented customer, order or date (GLOBAL-RULES §3), nothing about production.
 */
export async function AgentStory({ programme }: { programme: Programme }) {
  const [t, format] = await Promise.all([getTranslations("agent.landing.story"), getFormat()]);
  const example = programme.examples[1] ?? programme.examples[0] ?? null;

  const scenes: StoryScene[] = [
    {
      key: "share",
      label: t("share.label"),
      content: (
        <Scene
          tag={t("share.label")}
          before={t("share.before")}
          title={t("share.title")}
          toast={<Toast delay={3.4} title={t("share.toast")} detail={t("share.toastDetail")} />}
        >
          <div className="flex items-center gap-4 px-5 py-4">
            <span
              aria-hidden="true"
              className="border-border-strong rounded-control grid size-20 shrink-0 grid-cols-5 gap-0.5 border p-1.5"
            >
              {Array.from({ length: 25 }, (_, i) => (
                <span key={i} className={(i * 7) % 3 === 0 ? "bg-fg" : "bg-transparent"} />
              ))}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="bg-bg-subtle rounded-control text-muted truncate px-3 py-2 font-mono text-xs">
                {t("share.linkPlaceholder")}
              </span>
              <div className="flex flex-wrap gap-2">
                <Up delay={1} className="border-border-strong rounded-control border px-3 py-1.5 text-xs font-semibold">
                  {t("share.copy")}
                </Up>
                <Pressed cursorAt={1.8} pressAt={2.7}>
                  {t("share.line")}
                </Pressed>
              </div>
            </div>
          </div>
        </Scene>
      ),
    },
    {
      key: "lead",
      label: t("lead.label"),
      content: (
        <Scene tag={t("lead.label")} before={t("lead.before")} title={t("lead.title")}>
          <ul className="px-5 py-1">
            {LEAD_ROWS.map((row, index) => (
              <Up
                as="li"
                key={index}
                delay={0.9 + index * 0.3}
                className="border-border flex items-center gap-3 border-b py-3 last:border-b-0"
              >
                <span className="bg-primary-subtle text-primary grid size-8 shrink-0 place-items-center rounded-full">
                  <Icon name="user" size={16} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Line width={row.width} />
                  <span className="text-muted text-[11px]">
                    {t("lead.protected", { days: programme.leadProtectionDays })}
                  </span>
                </span>
                <Pill tone={row.stage === "quoted" ? "primary" : "muted"}>{t(`lead.stages.${row.stage}`)}</Pill>
              </Up>
            ))}
          </ul>
        </Scene>
      ),
    },
    {
      key: "quote",
      label: t("quote.label"),
      content: (
        <Scene
          tag={t("quote.label")}
          before={t("quote.before")}
          title={t("quote.title")}
          toast={<Toast delay={3.6} title={t("quote.toast")} detail={t("quote.toastDetail")} />}
        >
          <div className="border-border flex items-center justify-between gap-3 border-b px-5 py-4">
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <Line width="w-3/5" />
              <Line width="w-1/3" className="opacity-60" />
            </span>
            <Pressed cursorAt={1.6} pressAt={2.4}>
              {t("quote.send")}
            </Pressed>
          </div>
          <ul className="flex flex-col gap-2.5 px-5 py-4 text-sm">
            <Up as="li" delay={2.6} className="flex items-center gap-2.5">
              <Tick delay={2.7} />
              {t("quote.sent")}
            </Up>
            <Up as="li" delay={3.2} className="flex items-center gap-2.5">
              <Tick delay={3.3} />
              {t("quote.opened")}
            </Up>
          </ul>
        </Scene>
      ),
    },
    {
      key: "paid",
      label: t("paid.label"),
      content: (
        <Scene
          tag={t("paid.label")}
          before={t("paid.before")}
          title={t("paid.title")}
          toast={<Toast delay={3.2} title={t("paid.toast")} detail={t("paid.toastDetail")} />}
        >
          {example && programme.terms ? (
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 px-5 py-4 text-sm">
              <Up delay={0.9} className="contents">
                <dt className="text-muted">{t("paid.order")}</dt>
                <dd className="text-right font-semibold tabular-nums">{format.thb(example.orderValue)}</dd>
              </Up>
              <Up delay={1.3} className="contents">
                <dt className="text-muted">{t("paid.first", { pct: programme.terms.firstOrderPct })}</dt>
                <dd className="text-primary text-right text-lg font-bold tabular-nums">
                  {format.thb(example.firstOrder)}
                </dd>
              </Up>
            </dl>
          ) : (
            <div className="px-5 py-4">
              <Line width="w-1/2" />
            </div>
          )}
          <Foot>
            <Pill delay={2.2}>{t("paid.pill")}</Pill>
          </Foot>
        </Scene>
      ),
    },
  ];

  return (
    <HeroStory label={t("label")} roleDescription={t("role")} scenes={scenes} className="h-[31rem] sm:h-[33rem]" />
  );
}
