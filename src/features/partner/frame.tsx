import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { isApiError } from "@/lib/api/problem";
import { ErrorState } from "@/ui/components/ErrorState";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

/**
 * The frame of every partner screen: one `h1`, an optional way back, and a single column that
 * reads on a 6" phone and widens to two on a tablet (design-system.md §5). Server-only markup.
 */
export function PartnerPage({
  title,
  description,
  back,
  meta,
  actions,
  wide = false,
  full = false,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  wide?: boolean;
  /** Tables wider than prose (price lists): up to 80rem. */
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("mx-auto w-full px-4 py-5 md:px-6 md:py-8", full ? "max-w-7xl" : wide ? "max-w-5xl" : "max-w-3xl")}
    >
      {back ? (
        <Link
          href={back.href}
          className="text-muted hover:text-fg -ms-2 mb-2 inline-flex min-h-12 items-center gap-1 rounded-md px-2"
        >
          <Icon name="arrow-left" size={20} />
          {back.label}
        </Link>
      ) : null}
      <header className="flex flex-wrap items-start gap-3">
        {/* At least 16rem before the actions: on a phone they wrap under the title instead of squeezing it. */}
        <div className="min-w-[min(100%,16rem)] flex-1">
          <h1 className="font-semibold text-balance">{title}</h1>
          {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
          {description ? <p className="text-muted mt-2 max-w-prose">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      <div className="mt-6 flex flex-col gap-6 md:mt-5 md:gap-7">{children}</div>
    </div>
  );
}

/** A titled block of a partner screen. */
export function PartnerSection({
  title,
  description,
  actions,
  children,
  id,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section aria-labelledby={id ? `${id}-title` : undefined} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <h2 id={id ? `${id}-title` : undefined} className="text-[1.0625rem] font-semibold md:text-base">
            {title}
          </h2>
          {description ? <p className="text-muted text-sm">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/**
 * Why a server-rendered read failed. A `403` and a `404` are answers (another factory's id is a
 * 404 — D-044), not failures, so they get their own words; anything else names the request id.
 */
export async function PageError({ error }: { error: unknown }) {
  const t = await getTranslations("common.errors");
  const api = isApiError(error) ? error : null;
  if (api?.status === 403)
    return (
      <ErrorState
        title={t("forbiddenTitle")}
        description={t("forbiddenBody")}
        code={api.requestId}
        codeLabels={{ label: t("reference"), copy: t("copyReference"), copied: t("referenceCopied") }}
      />
    );
  if (api?.status === 404)
    return (
      <ErrorState
        title={t("itemNotFoundTitle")}
        description={t("itemNotFoundBody")}
        code={api.requestId}
        codeLabels={{ label: t("reference"), copy: t("copyReference"), copied: t("referenceCopied") }}
      />
    );
  return (
    <ErrorState
      title={t("loadFailedTitle")}
      description={api?.detail || t("loadFailedBody")}
      code={api?.requestId || undefined}
      codeLabels={{ label: t("reference"), copy: t("copyReference"), copied: t("referenceCopied") }}
    />
  );
}
