import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

const PREP_STEPS = ["template", "layer", "bleed", "images", "fonts", "export"] as const;
const AFTER_STEPS = ["prepress", "proof", "production", "delivery"] as const;
const FAQ = ["confidential", "files", "failing", "otherDielines"] as const;

function SectionHead({ id, title, body }: { id: string; title: string; body?: string }) {
  return (
    <div className="mb-5">
      <h2 id={id} className="text-[1.625rem] leading-tight font-semibold">
        {title}
      </h2>
      {body ? <p className="text-muted mt-1.5 max-w-[62ch] text-[0.90625rem]">{body}</p> : null}
    </div>
  );
}

/**
 * The lower sections of `/studio/upload` (upload redesign Phase 1 item 5): what is checked (the 12 checks — the ones
 * Prepress has not set a rule for yet say the team checks them, from `store.fileChecks.rules`), how to prepare a file
 * that passes first time, what happens after ordering and the FAQ. Only claims the system makes true: no `.joboptions`,
 * Figma plugin or Canva colour conversion (none exists), no review time or production days in copy (they come with the
 * price), no NDA promise until the business publishes one.
 */
export async function UploadSections({
  rules,
  maxLabel,
}: {
  rules: Schemas["FileCheckRulesDto"] | null;
  maxLabel: string | null;
}) {
  const t = await getTranslations("studio.upload");
  const evaluated = new Map(rules?.checks.map((c) => [c.check, c.evaluated]) ?? []);
  const checks = rules?.checks.map((c) => c.check) ?? [];
  const bleed = rules?.bleedMm ?? null;
  const safe = rules?.safeZoneMm ?? null;

  return (
    <>
      {checks.length ? (
        <section aria-labelledby="upload-checks" className="pt-14">
          <SectionHead id="upload-checks" title={t("sections.checksTitle")} body={t("sections.checksBody")} />
          <ol className="m-0 grid list-none gap-3 p-0 min-[1100px]:grid-cols-4 sm:grid-cols-2">
            {checks.map((check, index) => (
              <li key={check} className="rounded-card border-border bg-surface flex flex-col gap-1.5 border p-4">
                <span className="text-muted text-xs font-medium tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <b className="text-[0.9375rem] font-semibold">
                  {t(`checks.${check}.title`, { bleed: bleed ?? "", safe: safe ?? "" })}
                </b>
                <p className="text-muted m-0 text-[0.84375rem]">
                  {t(`checks.${check}.body`, { bleed: bleed ?? "", safe: safe ?? "" })}
                </p>
                {evaluated.get(check) === false ? (
                  <span className="text-muted mt-auto text-xs font-semibold">{t("sections.byTeam")}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section aria-labelledby="upload-prep" className="pt-14">
        <SectionHead id="upload-prep" title={t("sections.prepTitle")} body={t("sections.prepBody")} />
        <div className="grid items-start gap-6 min-[860px]:grid-cols-2">
          <ol className="m-0 list-none p-0">
            {PREP_STEPS.map((step, index) => (
              <li
                key={step}
                className={cn(
                  "border-border grid grid-cols-[2.25rem_1fr] gap-3.5 py-3.5",
                  index < PREP_STEPS.length - 1 && "border-b",
                )}
              >
                <span className="bg-primary-subtle text-primary grid size-9 place-items-center rounded-full font-semibold tabular-nums">
                  {index + 1}
                </span>
                <span>
                  <b className="font-semibold">{t(`prep.${step}.title`, { bleed: bleed ?? "3", safe: safe ?? "3" })}</b>
                  <p className="text-muted m-0 mt-0.5 text-sm">
                    {t(`prep.${step}.body`, { bleed: bleed ?? "3", safe: safe ?? "3" })}
                  </p>
                </span>
              </li>
            ))}
          </ol>
          <div className="rounded-card border-border bg-surface flex flex-col gap-3 border p-5">
            <h3 className="text-[1.0625rem] font-semibold">{t("apps.title")}</h3>
            {(["illustrator", "canva", "studio"] as const).map((app) => (
              <div
                key={app}
                className="border-border grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-t py-2.5"
              >
                <span className="bg-bg-subtle text-fg rounded-control grid size-10 place-items-center">
                  <Icon
                    name={app === "studio" ? "pen-tool" : app === "canva" ? "image" : "layers"}
                    size={20}
                    aria-hidden="true"
                  />
                </span>
                <span>
                  <b className="block text-sm font-semibold">{t(`apps.${app}.name`)}</b>
                  <small className="text-muted block text-[0.78125rem]">{t(`apps.${app}.body`)}</small>
                </span>
                {app === "studio" ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/studio">{t("apps.studio.cta")}</Link>
                  </Button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="upload-after" className="pt-14">
        <SectionHead id="upload-after" title={t("sections.afterTitle")} body={t("sections.afterBody")} />
        <ol className="m-0 grid list-none gap-3 p-0 min-[1100px]:grid-cols-4 sm:grid-cols-2">
          {AFTER_STEPS.map((step) => (
            <li key={step} className="border-primary border-t-[3px] px-0.5 pt-3.5">
              <b className="block text-[0.9375rem] font-semibold">{t(`after.${step}.title`)}</b>
              <p className="text-muted m-0 mt-1 text-[0.84375rem]">{t(`after.${step}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="upload-faq" className="pt-14 pb-24">
        <SectionHead id="upload-faq" title={t("sections.faqTitle")} />
        <div className="grid gap-x-6 min-[860px]:grid-cols-2">
          {FAQ.map((key) => (
            <details key={key} className="border-border group border-t py-3.5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                {t(`faq.${key}.q`)}
                <Icon
                  name="chevron-down"
                  size={18}
                  aria-hidden="true"
                  className="shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="text-muted m-0 mt-2 text-sm">{t(`faq.${key}.a`, { max: maxLabel ?? "—" })}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
