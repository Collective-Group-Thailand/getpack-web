import { getTranslations } from "next-intl/server";

import { BoxPreview } from "@/features/designer/components/BoxPreview";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";

import { CheckItem } from "./HomeHero";

/**
 * Home: the online studio on a dark band — what it does in three lines and two ways in, beside a
 * small picture of it. The picture is decoration (`aria-hidden`) drawn with tokens and a real
 * dieline, not a screenshot, so it cannot drift into promising a feature the studio lacks.
 */
export async function HomeStudio() {
  const t = await getTranslations("home.studio");
  const checks = ["styles", "preview3d", "dieline"] as const;

  // The board's deep-green band, full width, with grain (design language v2).
  return (
    <section
      aria-labelledby="home-studio"
      className="grain mt-24 overflow-hidden bg-[var(--green-ink)] text-white md:mt-30"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(60%_80%_at_85%_20%,rgba(95,207,180,.22),transparent_70%)]"
      />
      <div className="max-w-content relative mx-auto grid items-center gap-12 px-5 py-20 md:px-8 md:py-24 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <p className="eyebrow text-white/70">{t("kicker")}</p>
          <h2 id="home-studio" className="mt-3.5 text-4xl leading-[1.12] md:text-5xl">
            {t("titleLine1")}
            <br />
            <em className="text-[#5fcfb4]">{t("titleLine2")}</em>
          </h2>
          <p className="mt-4 max-w-[34em] text-[17px] leading-relaxed text-white/80">{t("body")}</p>
          <ul className="mt-6 grid gap-2.5">
            {checks.map((key) => (
              <CheckItem key={key} inverse>
                {t(`checks.${key}`)}
              </CheckItem>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary" className="border-white bg-white text-[#1e1b18]">
              <Link href="/studio/new">{t("start")}</Link>
            </Button>
            <Button
              asChild
              size="lg"
             
              variant="ghost"
              className="border border-white/40 text-white hover:bg-white/10"
            >
              <Link href="/styles">{t("library")}</Link>
            </Button>
          </div>
        </div>

        <StudioPicture title={t("pictureTitle")} size={t("pictureSize")} />
      </div>
    </section>
  );
}

function StudioPicture({ title, size }: { title: string; size: string }) {
  return (
    <div
      aria-hidden
      className="bg-canvas text-fg relative flex aspect-[4/3] flex-col overflow-hidden rounded-[1.375rem] shadow-[0_40px_80px_-40px_rgba(0,0,0,.55)]"
    >
      <div className="border-border bg-surface text-muted flex h-10 items-center gap-2 border-b px-3.5 text-xs">
        <span className="bg-border size-2.5 rounded-full" />
        <span className="bg-border size-2.5 rounded-full" />
        <span className="bg-border size-2.5 rounded-full" />
        <span className="ms-2.5 font-semibold">{title}</span>
        <span className="bg-primary-subtle text-primary-subtle-fg ms-auto rounded-md px-2 py-0.5 font-semibold">
          {size}
        </span>
      </div>
      <div className="grid flex-1 grid-cols-[3.5rem_1fr] sm:grid-cols-[3.5rem_1fr_9rem]">
        <div className="border-border bg-surface flex flex-col items-center gap-2.5 border-e pt-3">
          <span className="bg-primary size-8 rounded-lg" />
          <span className="bg-border size-8 rounded-lg" />
          <span className="bg-border size-8 rounded-lg" />
          <span className="bg-border size-8 rounded-lg" />
        </div>
        <div className="pk-dot-grid grid place-items-center p-4">
          <div className="h-full max-h-56 w-full">
            <BoxPreview styleId="tuck-end" values={{ length: 100, width: 50, height: 150 }} />
          </div>
        </div>
        <div className="border-border bg-surface text-muted hidden flex-col gap-2 border-s p-3 text-[0.6875rem] sm:flex">
          <span className="bg-border h-2.5 w-16 rounded" />
          {[10, 5, 15].map((value) => (
            <span key={value} className="flex items-center justify-between gap-2">
              <span className="bg-border h-2 w-8 rounded" />
              <span className="border-border bg-bg rounded border px-1.5">{value}</span>
            </span>
          ))}
          <span className="bg-border h-2 w-full rounded" />
          <span className="bg-primary mt-auto h-7 rounded-md" />
        </div>
      </div>
    </div>
  );
}
