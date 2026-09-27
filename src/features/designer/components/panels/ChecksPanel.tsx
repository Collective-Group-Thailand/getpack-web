"use client";

import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/i18n/format";
import { Callout } from "@/ui/components/Callout";
import { Icon } from "@/ui/icons";

import type { DesignIssue } from "../../lib/checks";
import { useEditor } from "../../store/editor";

/**
 * What would print badly, found while designing: each issue names the element and selects it,
 * so the fix is one click away. The proof and prepress remain the authority — these are the
 * checks a machine can make early.
 */
export function ChecksPanel({ issues }: { issues: DesignIssue[] }) {
  const t = useTranslations("designer.checks");
  const locale = useLocale() as "th" | "en";
  const elements = useEditor((s) => s.content.elements);
  const select = useEditor((s) => s.select);

  if (!elements.length) return <p className="text-muted text-sm">{t("empty")}</p>;
  if (!issues.length) return <Callout tone="success" title={t("allClear")} />;

  const errors = issues.filter((i) => i.severity === "error").length;
  const nameOf = (id: string) => {
    const el = elements.find((e) => e.id === id);
    if (!el) return "";
    return el.name ?? (el.type === "text" ? el.text.split("\n")[0]!.slice(0, 24) : t(`element.${el.type}`));
  };
  const data = (issue: DesignIssue) =>
    Object.fromEntries(Object.entries(issue.data ?? {}).map(([k, v]) => [k, formatNumber(v, locale)]));

  return (
    <div className="space-y-3">
      <p className="text-sm" role="status">
        {t("summary", { errors, warnings: issues.length - errors })}
      </p>
      <ul className="space-y-1">
        {issues.map((issue, index) => (
          <li key={`${issue.elementId}-${issue.code}-${index}`}>
            <button
              type="button"
              onClick={() => select(issue.elementId)}
              className="hover:bg-surface-subtle focus-visible:ring-focus-ring flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-start text-sm outline-none focus-visible:ring-2"
            >
              <Icon
                name={issue.severity === "error" ? "error" : "warning"}
                size={16}
                className={issue.severity === "error" ? "text-danger mt-0.5 shrink-0" : "text-warning mt-0.5 shrink-0"}
                aria-label={t(`severity.${issue.severity}`)}
              />
              <span>
                <span className="block">{t(`issue.${issue.code}`, data(issue))}</span>
                <span className="text-muted block text-xs">{nameOf(issue.elementId)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
