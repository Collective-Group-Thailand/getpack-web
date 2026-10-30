import { getTranslations } from "next-intl/server";
import { Icon } from "@/ui/icons";

const LINE = "bg-border-strong rounded-thumb block h-1.5";

/**
 * The shop-floor phone (pack Phase 3 item 4): the operator screen's real buttons (เสร็จ 1 ล็อต, หยุดชั่วคราว,
 * แจ้งของเสีย) around a placeholder job card — labelled as an illustration, no job data.
 */
export async function OperatorPhone() {
  const t = await getTranslations("pages.partner.floor");
  return (
    <figure role="img" aria-label={t("phoneLabel")} className="mx-auto w-[17.5rem]">
      <div className="shadow-panel relative p-3">
        {/* The bezel is always dark; the screen follows the page's theme (it sits outside the dark scope). */}
        <span aria-hidden="true" data-theme="dark" className="bg-bg rounded-panel absolute inset-0" />
        <div className="bg-bg text-fg rounded-card relative overflow-hidden text-[12.5px]">
          <div className="text-muted flex justify-between px-4 pt-2.5 pb-1.5 text-[11px] font-semibold">
            <span>{t("machine")}</span>
          </div>
          <div className="bg-surface rounded-card mx-3 my-1.5 flex flex-col gap-1.5 p-3.5" aria-hidden="true">
            <small className="text-muted">{t("nextGetpack")}</small>
            <span className="bg-border-strong rounded-thumb block h-2.5 w-4/5" />
            <span className="bg-border-strong rounded-thumb block h-1.5 w-3/5 opacity-60" />
            <span className="bg-bg-subtle rounded-thumb mt-1 block h-1 overflow-hidden">
              <span className="bg-primary block h-full w-[64%]" />
            </span>
          </div>
          <span className="bg-primary text-primary-fg rounded-card mx-3 mt-1.5 grid h-16 place-items-center text-lg font-bold">
            {t("done")}
          </span>
          <span className="mx-3 mt-2 mb-3.5 grid grid-cols-2 gap-2">
            <span className="border-border-strong bg-surface rounded-control grid h-12 place-items-center border text-[13px] font-semibold">
              {t("pause")}
            </span>
            <span className="border-border-strong bg-surface rounded-control grid h-12 place-items-center border text-[13px] font-semibold">
              {t("scrap")}
            </span>
          </span>
        </div>
      </div>
      <figcaption className="text-muted mt-2 text-center text-[11.5px]">{t("caption")}</figcaption>
    </figure>
  );
}

const SPEC_CHIPS = ["flute", "material", "dieline", "colour"] as const;
const QUEUE: { own: boolean; stage: "qc" | "running"; progress: number }[] = [
  { own: false, stage: "qc", progress: 60 },
  { own: true, stage: "running", progress: 40 },
];

/**
 * The getpack Factory hero picture (hero redesign 2026-10-30): today's jobs with a getpack job ready to take —
 * real product-type names from the catalogue as the job names, the real spec chips (ลอน · วัสดุ · ไดคัท · ค่าสี ΔE)
 * and no quantity, date or machine (GLOBAL-RULES §3) — beside the automatic journal posting (Dr/Cr account names,
 * no amounts) and the operator's three buttons. Without product types the job names are placeholder lines.
 */
export async function FactoryHero({ jobNames }: { jobNames: string[] }) {
  const t = await getTranslations("pages.partner.hero");
  const [featured, ...queue] = jobNames;
  return (
    <figure
      role="img"
      aria-label={t("label")}
      className="bg-bg-subtle rounded-panel relative px-4 pt-5 pb-4 sm:px-8 sm:pt-8 sm:pb-8 xl:pr-12 xl:pb-36 xl:pl-14"
    >
      {/* Before → now */}
      <p className="border-border bg-surface text-muted inline-flex max-w-full flex-wrap items-center gap-x-2.5 gap-y-1 rounded-full border px-3.5 py-1.5 text-[13px]">
        <s className="decoration-instant">{t("before")}</s>
        <Icon name="arrow-right" size={14} aria-hidden="true" className="text-fg shrink-0" />
        <b className="text-instant font-semibold tabular-nums">{t("now")}</b>
      </p>

      {/* Today's jobs */}
      <div className="border-border bg-surface rounded-panel shadow-panel mt-4 max-w-[32rem] overflow-hidden text-[13.5px]">
        <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3.5 sm:px-5">
          <b className="text-[15px] font-semibold">{t("today")}</b>
          <span className="bg-bg-subtle rounded-control hidden gap-0.5 p-0.5 text-xs sm:flex">
            <span className="bg-surface rounded-control px-2 py-0.5 font-semibold shadow-xs">{t("tabs.all")}</span>
            <span className="text-muted px-2 py-0.5">{t("tabs.getpack")}</span>
            <span className="text-muted px-2 py-0.5">{t("tabs.own")}</span>
          </span>
        </div>

        <div className="bg-primary-subtle/50 border-primary/30 m-3 rounded-[0.75rem] border p-3.5 sm:m-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-primary flex items-center gap-1.5 text-xs font-semibold">
                <span aria-hidden="true" className="bg-primary size-1.5 rounded-full" />
                {t("newJob")}
              </span>
              {featured ? (
                <b className="mt-1 block truncate text-[15px] font-semibold">{featured}</b>
              ) : (
                <span className={`${LINE} mt-2.5 block h-2.5 w-3/5`} aria-hidden="true" />
              )}
            </div>
            <span className="bg-primary text-primary-fg rounded-control shrink-0 px-3.5 py-2 text-[13px] font-semibold">
              {t("take")}
            </span>
          </div>
          <ul className="text-muted mt-3 flex flex-wrap gap-x-3.5 gap-y-1 text-xs">
            {(["checked", "spec", "price"] as const).map((point) => (
              <li key={point} className="flex items-center gap-1">
                <Icon name="check" size={12} aria-hidden="true" className="text-primary" />
                {t(`points.${point}`)}
              </li>
            ))}
          </ul>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {SPEC_CHIPS.map((chip) => (
              <li key={chip} className="border-border bg-surface rounded-control border px-2 py-0.5 text-xs">
                {t(`spec.${chip}`)}
              </li>
            ))}
          </ul>
        </div>

        <ul className="px-3 pb-1 sm:px-4">
          {QUEUE.map((job, index) => (
            <li key={index} className="border-border flex items-center gap-3 border-t py-3">
              <span
                className={
                  job.own
                    ? "bg-instant-subtle text-instant-subtle-fg rounded-control shrink-0 px-2 py-0.5 text-[11px] font-semibold"
                    : "bg-primary-subtle text-primary-subtle-fg rounded-control shrink-0 px-2 py-0.5 text-[11px] font-semibold"
                }
              >
                {job.own ? t("tabs.own") : t("tabs.getpack")}
              </span>
              {queue[index] ? (
                <span className="min-w-0 flex-1 truncate">{queue[index]}</span>
              ) : (
                <span className={`${LINE} flex-1`} aria-hidden="true" />
              )}
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="flex gap-0.5" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((seg) => (
                    <span
                      key={seg}
                      className={`h-1 w-3.5 rounded-full ${seg * 20 < job.progress ? "bg-primary" : "bg-border-strong"}`}
                    />
                  ))}
                </span>
                <span className="text-muted text-[11px]">{t(`stage.${job.stage}`)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Floating notes — only beside the card on a wide screen */}
      <div className="bg-surface border-border rounded-card shadow-panel absolute bottom-7 left-14 hidden w-[17rem] border p-3.5 text-[12.5px] xl:block">
        <span className="flex items-center justify-between font-semibold">
          {t("journal.title")}
          <span className="text-primary text-[11px]">{t("journal.auto")}</span>
        </span>
        <dl className="text-muted mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt>{t("journal.dr")}</dt>
          <dd className="text-fg text-right">{t("journal.debit")}</dd>
          <dt>{t("journal.cr")}</dt>
          <dd className="text-fg text-right">{t("journal.credit")}</dd>
        </dl>
        <p className="text-primary border-border mt-2.5 flex items-center gap-1.5 border-t pt-2 text-xs font-semibold">
          <Icon name="check" size={13} aria-hidden="true" />
          {t("journal.posted")}
        </p>
      </div>
      <div className="bg-fg text-fg-inverse rounded-card absolute right-8 bottom-7 hidden w-[17rem] p-3.5 text-[12.5px] xl:block">
        <span className="flex items-center justify-between font-semibold">
          {t("floor.title")}
          <span className="text-[11px] opacity-70">{t("floor.thai")}</span>
        </span>
        <span className="mt-2.5 grid grid-cols-3 gap-1.5 text-center text-[13px] font-semibold" aria-hidden="true">
          <span className="bg-primary text-primary-fg rounded-control py-2.5">{t("floor.start")}</span>
          <span className="rounded-control border border-white/25 py-2.5">{t("floor.pause")}</span>
          <span className="rounded-control border border-white/25 py-2.5">{t("floor.done")}</span>
        </span>
      </div>

      <figcaption className="text-muted mt-3 text-[11.5px] xl:absolute xl:top-3 xl:right-6 xl:mt-0">
        {t("caption")}
      </figcaption>
    </figure>
  );
}
