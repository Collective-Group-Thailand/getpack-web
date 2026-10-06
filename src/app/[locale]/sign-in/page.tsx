import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";

import { SignInPanel } from "@/features/customer/auth/SignInPanel";
import { AuthSplitLayout } from "@/features/shared/auth/AuthSplitLayout";
import { signInReturnTo } from "@/features/shared/auth/return-to";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { localePath, publicOrigin } from "@/lib/seo";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  // Not indexed: it is a step, not a destination, and it always carries someone else's returnTo.
  return { title: t("customer.title"), robots: { index: false, follow: true } };
}

/**
 * `/sign-in` (UX audit Flow 1, step 3): a page of its own with no navbar or footer — the brand
 * panel on the left, the form in a 440 px column on the right; below `md` the form alone.
 */
export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ returnTo?: string; provider?: string }>;
}) {
  const [{ locale }, query, t, origin] = await Promise.all([
    params,
    searchParams,
    getTranslations("auth.customer"),
    publicOrigin(),
  ]);
  setRequestLocale(locale);
  const returnTo = signInReturnTo(query.returnTo);
  // Where LINE's login page sends the customer back to: this page, flagged to finish the flow.
  const lineReturnUrl = `${origin}${localePath("/sign-in", hasLocale(routing.locales, locale) ? locale : routing.defaultLocale)}?provider=line&returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <AuthSplitLayout
      tone="brand"
      eyebrow={t("panel.eyebrow")}
      headline={t.rich("panel.headlineRich", { em: (chunks) => <em>{chunks}</em>, br: () => <br /> })}
      lead={t("panel.lead")}
      points={[t("panel.point1"), t("panel.point2"), t("panel.point3")]}
      note={{ title: t("panel.noteTitle"), body: t("panel.noteBody") }}
      homeLink={(children) => (
        <Link href="/" aria-label={t("panel.home")}>
          {children}
        </Link>
      )}
      topStart={
        <Link href="/" className="text-muted hover:text-fg inline-flex items-center gap-1.5 text-sm">
          <Icon name="chevron-left" size={16} aria-hidden="true" />
          {t("panel.backHome")}
        </Link>
      }
      topEnd={
        <span className="text-muted">
          {t("panel.newHere")}{" "}
          <span className="text-fg font-semibold">{t("panel.newHereAction")}</span>
        </span>
      }
    >
      <SignInPanel
        returnTo={returnTo}
        resume={query.provider === "line" ? "line" : undefined}
        lineReturnUrl={lineReturnUrl}
      />
    </AuthSplitLayout>
  );
}
