import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Icon } from "@/ui/icons";

/**
 * The page head (prototype `p15-deals.html`): title and lede, "n ดีลที่ใช้ได้ · อัปเดต HH:MM น." on the right, a
 * hairline; then, signed in, one strip "คูปองของคุณ · เก็บไว้ n ใบ · ใช้ได้กับตะกร้าตอนนี้ n ใบ" to the wallet.
 */
export async function DealsHeader({
  count,
  updatedAt,
  mine,
}: {
  count: number;
  /** "10:30", already in Bangkok time. */
  updatedAt: string;
  mine: { saved: number; usable: number | null } | null;
}) {
  const t = await getTranslations("deals");
  const b = (chunks: React.ReactNode) => <b className="text-fg font-semibold tabular-nums">{chunks}</b>;
  return (
    <>
      <header className="border-border flex flex-col gap-1 pt-6 md:flex-row md:items-end md:justify-between md:gap-6 md:border-b md:pt-10 md:pb-5">
        <div>
          <h1 className="m-0 text-[1.625rem] leading-tight font-semibold tracking-[-0.015em] md:text-[2rem]">
            {t("title")}
          </h1>
          <p className="text-muted m-0 mt-2 hidden text-[0.90625rem] md:block">{t("lede")}</p>
        </div>
        <p className="text-muted m-0 text-[0.84375rem] whitespace-nowrap md:pb-1">
          {t.rich("count", { count, b })}
          {" · "}
          {t("updated", { time: updatedAt })}
        </p>
      </header>
      {mine ? (
        <div
          role="note"
          className="border-border bg-surface rounded-card mt-4 flex min-h-13 items-center gap-3 border ps-4 pe-1.5 text-sm md:mt-5"
        >
          <Icon name="ticket" size={18} aria-hidden="true" className="text-primary shrink-0" />
          <p className="text-muted m-0 min-w-0 flex-1">
            <b className="text-fg font-semibold">{t("mine.label")}</b>
            <span className="max-md:hidden">
              {" · "}
              {t("mine.saved", { count: mine.saved })}
            </span>
            {mine.usable !== null ? (
              <>
                {" · "}
                {t.rich("mine.usable", { count: mine.usable, b })}
              </>
            ) : null}
          </p>
          <Link
            href="/account/wallet"
            className="text-primary rounded-control focus-visible:ring-focus-ring inline-flex min-h-11 shrink-0 items-center gap-0.5 px-2.5 font-medium outline-none hover:underline focus-visible:ring-2"
          >
            <span className="max-md:hidden">{t("mine.open")}</span>
            <span className="md:hidden">{t("mine.openShort")}</span>
            <Icon name="chevron-right" size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </>
  );
}

/** The views as underline tabs with plain counts (no pills); a tab with nothing in it is not offered. */
export async function DealTabs({
  current,
  counts,
  signedIn,
  type,
}: {
  current: string;
  counts: Record<"all" | "for_you" | "ending_soon" | "points", number>;
  signedIn: boolean;
  type: string | null;
}) {
  const t = await getTranslations("deals.tabs");
  // Loyalty P2: "สำหรับคุณ" is real — the deals the caller matches; a guest's are the new-customer deals, with a
  // sign-in prompt on the tab. A guest always sees it (it is how they learn the tab exists). "แลกด้วยแต้ม" has
  // nothing in it until P3.
  const tabs = (["all", "for_you", "ending_soon", "points"] as const).filter(
    (key) => key === "all" || key === current || counts[key] > 0 || (key === "for_you" && !signedIn),
  );
  const href = (key: string) => {
    const params = new URLSearchParams();
    if (key !== "all") params.set("tab", key);
    if (type) params.set("type", type);
    const query = params.toString();
    return query ? `/deals?${query}` : "/deals";
  };
  return (
    <nav aria-label={t("label")} className="max-md:border-border min-w-0 max-md:border-b">
      <ul className="m-0 flex [scrollbar-width:none] list-none gap-6 overflow-x-auto p-0 md:gap-7 [&::-webkit-scrollbar]:hidden">
        {tabs.map((key) => {
          const on = key === current;
          return (
            <li key={key} className="shrink-0">
              <Link
                href={href(key)}
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={
                  on
                    ? "border-primary text-fg -mb-px inline-flex min-h-11 items-baseline gap-1.5 border-b-2 pt-2.5 pb-3 text-[0.9375rem] font-semibold"
                    : "text-muted hover:text-fg -mb-px inline-flex min-h-11 items-baseline gap-1.5 border-b-2 border-transparent pt-2.5 pb-3 text-[0.9375rem] font-medium"
                }
              >
                {t(key)}
                <span
                  className={
                    on
                      ? "text-muted text-[0.8125rem] font-normal tabular-nums"
                      : "text-muted text-[0.8125rem] font-normal tabular-nums"
                  }
                >
                  {counts[key]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
