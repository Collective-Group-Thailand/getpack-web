import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Icon, type IconName } from "@/ui/icons";

const BENEFITS: { key: string; icon: IconName }[] = [
  { key: "team", icon: "users" },
  { key: "approval", icon: "check" },
  { key: "credit", icon: "wallet" },
  { key: "invoices", icon: "file-check" },
  { key: "branches", icon: "building" },
  { key: "reorder", icon: "refresh" },
];

/** Packio for business, for a visitor (F3 3.7): what a company account adds, and how to open one. */
export async function BusinessLanding({ signedIn }: { signedIn: boolean }) {
  const t = await getTranslations("business.landing");
  return (
    <div className="flex flex-col gap-14">
      <header className="flex max-w-3xl flex-col gap-4">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="text-4xl leading-[1.12] md:text-5xl lg:text-[3.5rem]">{t("title")}</h1>
        <p className="text-muted max-w-[40em] text-lg leading-relaxed">{t("intro")}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Button asChild size="lg" shape="pill" iconEnd="arrow-right">
            <Link href={signedIn ? "/business/apply" : `/sign-in?returnTo=${encodeURIComponent("/business/apply")}`}>
              {t("apply")}
            </Link>
          </Button>
          <Button asChild size="lg" shape="pill" variant="secondary">
            <Link href="/contact">{t("talk")}</Link>
          </Button>
        </div>
      </header>
      <section aria-labelledby="business-benefits">
        <h2 id="business-benefits" className="text-2xl">
          {t("benefits")}
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <li
              key={benefit.key}
              className="border-border bg-surface flex flex-col gap-4 rounded-[var(--radius-card)] border p-6"
            >
              <span className="bg-primary-subtle text-primary grid size-11 place-items-center rounded-[14px]">
                <Icon name={benefit.icon} size={22} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-[17px] font-semibold">{t(`benefit.${benefit.key}.title`)}</h3>
                <p className="text-muted mt-1.5 text-sm leading-relaxed">{t(`benefit.${benefit.key}.body`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section
        aria-labelledby="business-steps"
        className="grain relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--green-ink)] p-7 text-white md:p-10"
      >
        <h2 id="business-steps" className="serif relative text-[1.75rem]">
          {t("stepsTitle")}
        </h2>
        <ol className="relative mt-6 grid gap-6 md:grid-cols-3">
          {(["one", "two", "three"] as const).map((step, index) => (
            <li key={step} className="flex gap-4 border-t border-white/15 pt-5">
              <span
                className="serif shrink-0 text-4xl leading-none font-medium text-[var(--kraft-3)] italic"
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="font-semibold">{t(`steps.${step}.title`)}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/75">{t(`steps.${step}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
