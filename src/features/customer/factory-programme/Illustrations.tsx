import { getTranslations } from "next-intl/server";

/** Skeleton lines and progress widths of the drawings — shapes, not data. */
const JOBS: { column: "plan" | "running" | "qc" | "ready"; own: boolean; progress?: number }[] = [
  { column: "plan", own: false },
  { column: "plan", own: true },
  { column: "running", own: false, progress: 64 },
  { column: "running", own: true, progress: 30 },
  { column: "qc", own: false },
  { column: "ready", own: false },
  { column: "ready", own: true },
];
const COLUMNS = ["plan", "running", "qc", "ready"] as const;
const LINE = "bg-border-strong rounded-thumb block h-1.5";

/**
 * The getpack Factory hero picture (pack Phase 3 item 1): a labelled illustration of the production board — the
 * board's real column names and the two job sources, with neutral placeholder lines instead of job names, quantities,
 * dates or machines (GLOBAL-RULES §3: no sample data). A real screenshot replaces it once supplied.
 */
export async function ProductionBoard() {
  const t = await getTranslations("pages.partner.board");
  return (
    <figure
      role="img"
      aria-label={t("label")}
      className="bg-surface border-border rounded-panel shadow-panel overflow-hidden text-[12.5px]"
    >
      <div className="border-border text-muted flex items-center gap-2.5 border-b px-4 py-3">
        <b className="text-fg font-semibold">{t("title")}</b>
        <span>· {t("view")}</span>
        <span className="ml-auto hidden gap-1.5 sm:flex">
          <span className="bg-bg-subtle rounded-control px-2 py-0.5 text-[11.5px]">{t("today")}</span>
          <span className="bg-bg-subtle rounded-control px-2 py-0.5 text-[11.5px]">{t("machines")}</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        {COLUMNS.map((column) => (
          <div key={column} className="bg-bg-subtle rounded-card flex min-w-0 flex-col gap-1.5 p-2">
            <h4 className="text-muted mx-1 mt-0.5 mb-1 text-[11px] font-medium">{t(`columns.${column}`)}</h4>
            {JOBS.filter((job) => job.column === column).map((job, index) => (
              <div
                key={index}
                className="bg-surface border-border rounded-control flex flex-col gap-1.5 border p-2"
                aria-hidden="true"
              >
                <span
                  className={
                    job.own
                      ? "bg-instant-subtle text-instant-subtle-fg rounded-thumb self-start px-1.5 py-px text-[10.5px] font-semibold"
                      : "bg-primary-subtle text-primary-subtle-fg rounded-thumb self-start px-1.5 py-px text-[10.5px] font-semibold"
                  }
                >
                  {job.own ? t("own") : t("fromGetpack")}
                </span>
                <span className={`${LINE} w-4/5`} />
                {job.progress !== undefined ? (
                  <span className="bg-bg-subtle rounded-thumb block h-1 overflow-hidden">
                    <span className="bg-primary block h-full" style={{ width: `${job.progress}%` }} />
                  </span>
                ) : null}
                <span className={`${LINE} w-1/2 opacity-60`} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
        <p className="bg-bg-subtle rounded-control flex items-start gap-2 p-2.5">
          <span aria-hidden="true" className="bg-warning mt-1.5 size-2 shrink-0 rounded-full" />
          <span className="text-muted">{t("stock")}</span>
        </p>
        <p className="bg-bg-subtle rounded-control flex items-start gap-2 p-2.5">
          <span aria-hidden="true" className="bg-danger mt-1.5 size-2 shrink-0 rounded-full" />
          <span className="text-muted">{t("repair")}</span>
        </p>
      </div>
      <figcaption className="text-subtle px-4 pb-3 text-[11.5px]">{t("caption")}</figcaption>
    </figure>
  );
}

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
          <div className="text-subtle flex justify-between px-4 pt-2.5 pb-1.5 text-[11px] font-semibold">
            <span>{t("machine")}</span>
          </div>
          <div className="bg-surface rounded-card mx-3 my-1.5 flex flex-col gap-1.5 p-3.5" aria-hidden="true">
            <small className="text-subtle">{t("nextGetpack")}</small>
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
      <figcaption className="text-subtle mt-2 text-center text-[11.5px]">{t("caption")}</figcaption>
    </figure>
  );
}
