import { getTranslations } from "next-intl/server";

import { HeroStory, type StoryScene } from "@/features/customer/hero-story/HeroStory";
import { Foot, Pill, Pressed, Scene, Tick, Toast, Up, at } from "@/features/customer/hero-story/parts";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

const BOARD: { own: boolean; stage: "qc" | "running" | "shipping" | "billing" }[] = [
  { own: false, stage: "qc" },
  { own: true, stage: "running" },
  { own: false, stage: "shipping" },
  { own: true, stage: "billing" },
];
const SPEC = ["flute", "material", "dieline", "colour"] as const;
const JOURNAL = ["debit", "credit", "vat"] as const;

/**
 * The getpack Factory hero story (hero redesign 2026-10-30, variant A): five scenes — a getpack job to take,
 * every job source in one system, built for packaging factories, automatic posting to the ledger, the shop
 * floor. Job names are real product-type names from the catalogue (placeholder lines without them); no
 * quantity, date, machine, customer or amount (GLOBAL-RULES §3), and nothing about existing partner factories.
 */
export async function FactoryStory({ jobNames }: { jobNames: string[] }) {
  const t = await getTranslations("pages.partner.story");
  const name = (index: number) => jobNames[index % Math.max(jobNames.length, 1)];
  // A job name from the catalogue, or a placeholder line when the catalogue gave none.
  const job = (index: number, className?: string) =>
    name(index) ? (
      <span className={cn("truncate", className)}>{name(index)}</span>
    ) : (
      <span className={cn("bg-border-strong rounded-thumb block h-2 w-2/5", className)} aria-hidden="true" />
    );

  const scenes: StoryScene[] = [
    {
      key: "job",
      label: t("job.label"),
      content: (
        <Scene
          tag={t("job.label")}
          before={t("job.before")}
          title={t("job.title")}
          toast={<Toast delay={3.4} title={t("job.toast")} detail={t("job.toastDetail")} />}
        >
          <div className="border-border flex items-start justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <span className="text-primary flex items-center gap-1.5 text-xs font-semibold">
                <span aria-hidden="true" className="pk-story-ping bg-primary size-1.5 rounded-full" />
                {t("job.new")}
              </span>
              <b className="mt-1 block text-[15px] font-semibold">{job(0)}</b>
            </div>
            <Pressed cursorAt={1.9} pressAt={2.9}>
              {t("job.take")}
            </Pressed>
          </div>
          <ul className="flex flex-col gap-2.5 px-5 py-4">
            {(["checked", "spec", "price"] as const).map((point, index) => (
              <Up key={point} delay={0.9 + index * 0.3} className="flex items-center gap-2.5 text-sm">
                <Tick delay={1.1 + index * 0.3} />
                {t(`job.points.${point}`)}
              </Up>
            ))}
          </ul>
        </Scene>
      ),
    },
    {
      key: "board",
      label: t("board.label"),
      content: (
        <Scene tag={t("board.label")} before={t("board.before")} title={t("board.title")}>
          <div className="border-border flex items-center justify-between border-b px-5 py-3">
            <b className="text-sm font-semibold">{t("board.today")}</b>
            <span className="bg-bg-subtle rounded-control flex gap-0.5 p-0.5 text-xs">
              <span className="bg-surface rounded-control px-2 py-0.5 font-semibold shadow-xs">{t("board.all")}</span>
              <span className="text-muted px-2 py-0.5">{t("board.getpack")}</span>
              <span className="text-muted px-2 py-0.5">{t("board.own")}</span>
            </span>
          </div>
          <ul className="px-5 py-1">
            {BOARD.map((entry, index) => (
              <Up
                key={index}
                delay={0.9 + index * 0.3}
                className="border-border flex items-center gap-3 border-b py-2.5 text-sm last:border-b-0"
              >
                <span
                  className={cn(
                    "rounded-control shrink-0 px-2 py-0.5 text-[11px] font-semibold",
                    entry.own ? "bg-bg-subtle text-muted" : "bg-primary-subtle text-primary",
                  )}
                >
                  {entry.own ? t("board.own") : t("board.getpack")}
                </span>
                {job(index, "min-w-0 flex-1")}
                <Pill tone="muted">{t(`board.stages.${entry.stage}`)}</Pill>
              </Up>
            ))}
          </ul>
        </Scene>
      ),
    },
    {
      key: "spec",
      label: t("spec.label"),
      content: (
        <Scene tag={t("spec.label")} before={t("spec.before")} title={t("spec.title")}>
          <dl className="grid gap-x-6 gap-y-3.5 px-5 py-4 sm:grid-cols-2">
            {SPEC.map((item, index) => (
              <Up key={item} delay={0.9 + index * 0.3} className="flex items-center gap-3">
                <span className="bg-primary-subtle text-primary rounded-control grid size-9 shrink-0 place-items-center">
                  {item === "colour" ? (
                    <span
                      className="pk-story-swatch bg-instant block size-4 rounded-full"
                      style={at(1.9)}
                      aria-hidden="true"
                    />
                  ) : (
                    <Icon
                      name={item === "flute" ? "layers" : item === "material" ? "package" : "scan"}
                      size={18}
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span>
                  <dt className="text-muted text-xs">{t(`spec.items.${item}.label`)}</dt>
                  <dd className="text-sm font-semibold">{t(`spec.items.${item}.value`)}</dd>
                </span>
              </Up>
            ))}
          </dl>
          <Foot>
            <Pill delay={2.6}>{t("spec.pill")}</Pill>
          </Foot>
        </Scene>
      ),
    },
    {
      key: "ledger",
      label: t("ledger.label"),
      content: (
        <Scene
          tag={t("ledger.label")}
          before={t("ledger.before")}
          title={t("ledger.title")}
          toast={<Toast delay={3} title={t("ledger.toast")} detail={t("ledger.toastDetail")} />}
        >
          <div className="border-border text-muted flex items-center gap-2 border-b px-5 py-3 text-xs">
            <Icon name="receipt" size={14} aria-hidden="true" />
            {t("ledger.document")} · {job(1)}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 px-5 py-4 text-sm">
            {JOURNAL.map((line, index) => (
              <Up key={line} delay={0.9 + index * 0.4} className="contents">
                <dt className="text-muted">{t(`ledger.lines.${line}.side`)}</dt>
                <dd className={cn("font-semibold", line !== "debit" && "pl-6")}>{t(`ledger.lines.${line}.account`)}</dd>
              </Up>
            ))}
          </dl>
          <Foot>
            <Pill delay={2.4}>{t("ledger.pill")}</Pill>
          </Foot>
        </Scene>
      ),
    },
    {
      key: "floor",
      label: t("floor.label"),
      content: (
        <Scene
          tag={t("floor.label")}
          before={t("floor.before")}
          title={t("floor.title")}
          toast={<Toast delay={3.2} title={t("floor.toast")} detail={t("floor.toastDetail")} />}
        >
          <div className="border-border flex items-center justify-between border-b px-5 py-3 text-sm">
            <b className="font-semibold">{t("floor.machine")}</b>
            <Pill>{t("floor.running")}</Pill>
          </div>
          <div className="grid grid-cols-3 gap-2 px-5 py-4 text-center text-sm font-semibold">
            <Up delay={0.9} className="bg-primary text-primary-fg rounded-control py-3.5">
              {t("floor.start")}
            </Up>
            <Up delay={1.1} className="border-border-strong rounded-control border py-3.5">
              {t("floor.pause")}
            </Up>
            <Up delay={1.3} className="border-border-strong rounded-control border py-3.5">
              {t("floor.done")}
            </Up>
          </div>
        </Scene>
      ),
    },
  ];

  return (
    <HeroStory label={t("label")} roleDescription={t("role")} scenes={scenes} className="h-[33rem] sm:h-[35rem]" />
  );
}
