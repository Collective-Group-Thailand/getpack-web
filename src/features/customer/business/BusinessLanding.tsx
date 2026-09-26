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
    <div className="flex flex-col gap-12">
      <header className="flex max-w-3xl flex-col gap-4">
        <p className="text-primary font-medium">{t("eyebrow")}</p>
        <h1 className="text-3xl font-bold md:text-4xl">{t("title")}</h1>
        <p className="text-muted text-lg">{t("intro")}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href={signedIn ? "/business/apply" : `/sign-in?returnTo=${encodeURIComponent("/business/apply")}`}>
              {t("apply")}
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/contact">{t("talk")}</Link>
          </Button>
        </div>
      </header>
      <section aria-labelledby="business-benefits">
        <h2 id="business-benefits" className="text-xl font-semibold">
          {t("benefits")}
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <li key={benefit.key} className="border-border flex gap-3 rounded-xl border p-5">
              <Icon name={benefit.icon} size={22} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <h3 className="font-semibold">{t(`benefit.${benefit.key}.title`)}</h3>
                <p className="text-muted mt-1 text-sm">{t(`benefit.${benefit.key}.body`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="business-steps" className="bg-surface-subtle rounded-2xl p-6">
        <h2 id="business-steps" className="text-xl font-semibold">
          {t("stepsTitle")}
        </h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          {(["one", "two", "three"] as const).map((step, index) => (
            <li key={step} className="flex gap-3">
              <span
                className="bg-primary text-primary-fg flex size-8 shrink-0 items-center justify-center rounded-full font-semibold"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div>
                <p className="font-medium">{t(`steps.${step}.title`)}</p>
                <p className="text-muted text-sm">{t(`steps.${step}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
