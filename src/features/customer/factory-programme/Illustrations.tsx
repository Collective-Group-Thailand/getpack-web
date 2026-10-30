import { getTranslations } from "next-intl/server";

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
