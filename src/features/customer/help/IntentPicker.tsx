"use client";

import { useTranslations } from "next-intl";

import { useFirstRun } from "@/features/shared/first-run/useFirstRun";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Icon, type IconName } from "@/ui/icons";

type Intent = "have_product" | "have_file" | "need_design" | "reorder";
type Here = "configurator" | "studio";

const ICONS: Record<Intent, IconName> = {
  have_product: "package",
  have_file: "document",
  need_design: "palette",
  reorder: "refresh",
};

/** The shortest path for each intent, from where the customer is now; `null` = this page is it. */
function pathFor(intent: Intent, here: Here, productSlug: string | null): string | null {
  switch (intent) {
    case "have_product":
    case "have_file":
      // Sizing from the product (the advisor) and ordering with your own file both start in the configurator.
      return here === "configurator" ? null : productSlug ? `/configure/${productSlug}` : "/products";
    case "need_design":
      return here === "studio"
        ? null
        : `/studio/new${productSlug ? `?product=${encodeURIComponent(productSlug)}` : ""}`;
    case "reorder":
      return "/account";
  }
}

/**
 * "What brings you here?" on a first visit to the studio or the configurator (U5.2 §1): four
 * intents, each sent the shortest way — or told this page is already it. Inline, never a modal;
 * dismissed for good with "ข้าม", and re-opened from the link it leaves behind.
 */
export function IntentPicker({ here, productSlug = null }: { here: Here; productSlug?: string | null }) {
  const t = useTranslations("help.intent");
  const router = useRouter();
  const { show, dismiss, reopen } = useFirstRun("intent-v1");

  if (!show)
    return (
      <button
        type="button"
        onClick={reopen}
        className="text-primary self-start text-sm underline-offset-4 hover:underline"
      >
        {t("reopen")}
      </button>
    );

  return (
    <section
      aria-labelledby="intent-title"
      className="border-primary/30 bg-primary-subtle flex flex-col gap-3 rounded-2xl border p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="intent-title" className="font-semibold">
            {t("title")}
          </h2>
          <p className="text-muted text-sm">{t("body")}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={dismiss}>
          {t("skip")}
        </Button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(ICONS) as Intent[]).map((intent) => (
          <li key={intent}>
            <button
              type="button"
              onClick={() => {
                const path = pathFor(intent, here, productSlug);
                dismiss();
                if (path) router.push(path);
              }}
              className="border-border bg-surface hover:border-primary focus-visible:ring-focus-ring flex w-full items-start gap-3 rounded-xl border p-3 text-start outline-none focus-visible:ring-2"
            >
              <Icon name={ICONS[intent]} size={20} className="text-primary mt-0.5 shrink-0" />
              <span>
                <span className="block text-sm font-medium">{t(`${intent}.title`)}</span>
                <span className="text-muted block text-xs">
                  {pathFor(intent, here, productSlug) ? t(`${intent}.go`) : t(`${intent}.here`)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
