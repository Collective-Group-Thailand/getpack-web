import { getTranslations } from "next-intl/server";

/** Relative bar heights of the illustration — a drawing, not data (no figure is shown or implied). */
const BARS = [78, 52, 64, 30, 41];

/**
 * The hero's picture of the company account (business pack Phase 1 item 1): a static illustration labelled
 * "ตัวอย่างหน้าจอ", built from the account's real section names with neutral placeholder bars — no company name,
 * amount, branch or order (GLOBAL-RULES §3: no sample data). A real screenshot replaces it once Marketing supplies
 * one (OPEN QUESTION in the C10 report).
 */
export async function DashboardIllustration() {
  const t = await getTranslations("business.landing.screen");
  const skeleton = "bg-border-strong rounded-thumb block h-2";
  return (
    <figure
      role="img"
      aria-label={t("label")}
      className="bg-surface border-border rounded-panel shadow-panel overflow-hidden text-[13px]"
    >
      <div className="border-border text-muted flex items-center gap-2.5 border-b px-4 py-3">
        <span className="bg-primary text-primary-fg rounded-control grid size-7 place-items-center" aria-hidden="true">
          <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
            <rect x="3" y="3" width="10" height="10" rx="2" />
          </svg>
        </span>
        <b className="text-fg font-semibold">{t("company")}</b>
        <span className="ml-auto hidden gap-1 sm:flex">
          {(["overview", "orders", "team", "statements"] as const).map((tab, index) => (
            <span
              key={tab}
              className={index === 0 ? "bg-bg-subtle text-fg rounded-control px-2.5 py-1" : "px-2.5 py-1"}
            >
              {t(`tabs.${tab}`)}
            </span>
          ))}
        </span>
      </div>
      <div className="grid gap-2.5 p-3.5 sm:grid-cols-2">
        <div className="bg-bg-subtle border-border rounded-card border p-3.5">
          <h4 className="text-muted mb-3 text-xs font-medium">{t("spend")}</h4>
          <div className="flex h-24 items-end gap-2" aria-hidden="true">
            {BARS.map((height, index) => (
              <span key={index} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="bg-primary rounded-thumb w-full" style={{ height: `${height}%` }} />
                <span className={`${skeleton} w-3/4`} />
              </span>
            ))}
          </div>
        </div>
        <div className="bg-bg-subtle border-border rounded-card border p-3.5">
          <h4 className="text-muted mb-3 text-xs font-medium">{t("pending")}</h4>
          <div className="flex flex-col gap-2" aria-hidden="true">
            {[0, 1].map((row) => (
              <div key={row} className="bg-surface rounded-control flex items-center gap-2 px-2.5 py-2">
                <span className="flex flex-1 flex-col gap-1.5">
                  <span className={`${skeleton} w-4/5`} />
                  <span className={`${skeleton} w-1/2 opacity-60`} />
                </span>
                <span className="bg-primary text-primary-fg rounded-control px-2.5 py-1 text-xs font-semibold">
                  {t("approve")}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-bg-subtle border-border rounded-card border p-3.5">
          <h4 className="text-muted mb-3 text-xs font-medium">{t("credit")}</h4>
          <span className="bg-surface rounded-thumb block h-2 overflow-hidden" aria-hidden="true">
            <span className="bg-primary block h-full w-2/5" />
          </span>
          <span className={`${skeleton} mt-2.5 w-2/3 opacity-60`} aria-hidden="true" />
        </div>
        <div className="bg-bg-subtle border-border rounded-card border p-3.5">
          <h4 className="text-muted mb-3 text-xs font-medium">{t("reorder")}</h4>
          <span className="flex flex-col gap-1.5" aria-hidden="true">
            <span className={`${skeleton} w-3/4`} />
            <span className={`${skeleton} w-1/2 opacity-60`} />
          </span>
        </div>
      </div>
      <figcaption className="text-muted px-4 pb-3 text-[11.5px]">{t("caption")}</figcaption>
    </figure>
  );
}
