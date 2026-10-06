import { getTranslations } from "next-intl/server";

import { BoxPreview } from "@/features/designer/components/BoxPreview";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { SectionHeading } from "@/ui/components/SectionHeading";

import { CheckItem } from "./HomeHero";

/**
 * Home: the online studio on a dark band — what it does in three lines and two ways in, beside a
 * small picture of it. The picture is decoration (`aria-hidden`) drawn with tokens and a real
 * dieline, not a screenshot, so it cannot drift into promising a feature the studio lacks.
 */
export async function HomeStudio() {
  const t = await getTranslations("home.studio");
  const checks = ["styles", "preview3d", "dieline"] as const;

  return (
    <section aria-labelledby="home-studio" className="max-w-content mx-auto px-5 pt-16 md:px-8 md:pt-26">
      <div className="bg-fg text-fg-inverse relative grid items-center gap-12 overflow-hidden rounded-2xl p-7 md:p-14 lg:grid-cols-2">
        <div aria-hidden className="pk-band-glow absolute inset-0" />
        <div className="relative">
          <SectionHeading
            id="home-studio"
            inverse
            kicker={t("kicker")}
            title={
              <>
                {t("titleLine1")}
                <br />
                {t("titleLine2")}
              </>
            }
            description={t("body")}
            className="mb-0 md:mb-0"
          />
          <ul className="mt-6 grid gap-2.5">
            {checks.map((key) => (
              <CheckItem key={key} inverse>
                {t(`checks.${key}`)}
              </CheckItem>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary" className="border-surface rounded-xl">
              <Link href="/studio/new">{t("start")}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="border-fg-inverse/25 text-fg-inverse rounded-xl border"
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
      className="border-fg-inverse/10 bg-canvas text-fg relative flex aspect-[4/3] flex-col overflow-hidden rounded-xl border"
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
