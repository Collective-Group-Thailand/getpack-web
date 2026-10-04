"use client";

import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/i18n/format";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Icon } from "@/ui/icons";

import type { DesignIssue } from "../../lib/checks";
import { useFaceNames } from "../../lib/useFaceNames";
import { useEditor } from "../../store/editor";
import { useDesigner } from "../DesignerContext";

export interface ChecksPanelProps {
  issues: DesignIssue[];
  /** Applies a finding's safe fix (the editor knows the sheet's geometry and the rules). */
  onFix?: (issue: DesignIssue) => void;
  /** Whether a warning has been accepted for this version (stored by packio-api, D-278). */
  acknowledged?: (issue: DesignIssue) => boolean;
  onAcknowledge?: (issue: DesignIssue) => void;
}

const ORDER = { block: 0, warn: 1, info: 2 } as const;

/**
 * The checks panel (U4.5, studio-spec §2 ④): counts by severity, then every finding in one sentence
 * — what is wrong, on which element and face — selecting the element on click, with a one-click fix
 * where one is safe and, for a warning, an explicit acknowledgement kept with the design version.
 * Blocks must be fixed before ordering; the proof and prepress remain the authority.
 */
export function ChecksPanel({ issues, onFix, acknowledged, onAcknowledge }: ChecksPanelProps) {
  const t = useTranslations("designer.checks");
  const locale = useLocale() as "th" | "en";
  const elements = useEditor((s) => s.content.elements);
  const select = useEditor((s) => s.select);
  const { dieline } = useDesigner();
  const faces = useFaceNames(dieline);

  if (!elements.length) return <p className="text-muted text-sm">{t("empty")}</p>;
  if (!issues.length) return <Callout tone="success" title={t("allClear")} />;

  const counts = { block: 0, warn: 0, info: 0 };
  for (const issue of issues) counts[issue.severity] += 1;
  const sorted = [...issues].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  const elementOf = (id: string) => elements.find((e) => e.id === id);
  const nameOf = (id: string) => {
    const el = elementOf(id);
    if (!el) return "";
    const name = el.name ?? (el.type === "text" ? el.text.split("\n")[0]!.slice(0, 24) : t(`element.${el.type}`));
    const face = el.clipFaceId ? faces.get(el.clipFaceId) : undefined;
    return face ? t("onFace", { name, face }) : name;
  };
  const data = (issue: DesignIssue) =>
    Object.fromEntries(
      Object.entries(issue.data ?? {}).map(([k, v]) => [
        k,
        typeof v === "number"
          ? formatNumber(v, locale)
          : k === "problems"
            ? v
                .split(",")
                .map((p) => (t.has(`problems.${p}`) ? t(`problems.${p}` as never) : p))
                .join(", ")
            : v,
      ]),
    );

  return (
    <div className="space-y-3">
      <p className="flex flex-wrap gap-2 text-sm" role="status">
        <Badge tone={counts.block ? "danger" : "neutral"}>{t("count.block", { count: counts.block })}</Badge>
        <Badge tone={counts.warn ? "warning" : "neutral"}>{t("count.warn", { count: counts.warn })}</Badge>
        {counts.info ? <Badge tone="neutral">{t("count.info", { count: counts.info })}</Badge> : null}
      </p>
      <ul className="space-y-2">
        {sorted.map((issue, index) => {
          const accepted = issue.severity === "warn" && acknowledged?.(issue);
          return (
            <li key={`${issue.elementId}-${issue.ruleId}-${index}`} className="space-y-1">
              <button
                type="button"
                disabled={!issue.elementId}
                onClick={() => {
                  // An issue on the other side of the board turns the view to it first (U4.3).
                  const editor = useEditor.getState();
                  const el = elementOf(issue.elementId);
                  const side = el?.side === "inside" ? "inside" : "outside";
                  if (el && side !== editor.side) editor.setSide(side);
                  select(issue.elementId);
                }}
                className="hover:bg-surface-subtle focus-visible:ring-focus-ring flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-start text-sm outline-none focus-visible:ring-2 disabled:cursor-default"
              >
                <Icon
                  name={issue.severity === "block" ? "error" : issue.severity === "warn" ? "warning" : "info"}
                  size={16}
                  className={
                    issue.severity === "block"
                      ? "text-danger mt-0.5 shrink-0"
                      : issue.severity === "warn"
                        ? "text-warning mt-0.5 shrink-0"
                        : "text-muted mt-0.5 shrink-0"
                  }
                  aria-label={t(`severity.${issue.severity}`)}
                />
                <span>
                  <span className="block">{t(`rule.${issue.ruleId}`, data(issue))}</span>
                  {issue.elementId ? <span className="text-muted block text-xs">{nameOf(issue.elementId)}</span> : null}
                </span>
              </button>
              {(issue.fix && onFix) || (issue.severity === "warn" && onAcknowledge) ? (
                <div className="flex flex-wrap gap-2 ps-8">
                  {issue.fix && onFix ? (
                    <Button size="sm" variant="secondary" onClick={() => onFix(issue)}>
                      {t(`fix.${issue.fix}`)}
                    </Button>
                  ) : null}
                  {issue.severity === "warn" && onAcknowledge ? (
                    accepted ? (
                      <span className="text-muted flex items-center gap-1 text-xs">
                        <Icon name="check" size={14} aria-hidden="true" /> {t("acknowledged")}
                      </span>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => onAcknowledge(issue)}>
                        {t("acknowledge")}
                      </Button>
                    )
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
