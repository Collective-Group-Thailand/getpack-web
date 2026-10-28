"use client";

import { useTranslations } from "next-intl";

import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import type { RailId } from "../shell/panels";
import { IssueBadge, type ShellStep } from "./TopBarParts";

/**
 * The Studio editor's frame (editor redesign Phase 1 item 1, `editor-prototype.html`): a top bar; an icon rail with
 * its asset panel; the stage; the inspector with its three tabs; a status bar. ≥ 1180 px the full layout, 900–1180 a
 * compact one, below 900 px it stacks — stage, inspector, rail, panel — with no horizontal page scroll at 360 px.
 */
export function StudioFrame({
  top,
  notes,
  rail,
  panel,
  stage,
  inspector,
  status,
}: {
  top: React.ReactNode;
  /** Bars under the top bar (read-only, a draft to restore, the phone note). */
  notes?: React.ReactNode;
  rail: React.ReactNode;
  panel: React.ReactNode;
  stage: React.ReactNode;
  inspector: React.ReactNode;
  status: React.ReactNode;
}) {
  return (
    <div className="bg-bg text-fg grid h-dvh grid-rows-[auto_auto_minmax(0,1fr)_30px] max-[899px]:h-auto max-[899px]:min-h-dvh max-[899px]:grid-rows-[auto_auto_auto]">
      {top}
      <div>{notes}</div>
      <div className="grid min-h-0 grid-cols-[56px_272px_minmax(0,1fr)_296px] max-[1180px]:grid-cols-[52px_240px_minmax(0,1fr)_270px] max-[899px]:grid-cols-[minmax(0,1fr)]">
        <div className="min-h-0 max-[899px]:order-3">{rail}</div>
        <div className="min-h-0 min-w-0 max-[899px]:order-4">{panel}</div>
        <div className="relative min-h-0 min-w-0 max-[899px]:order-1 max-[899px]:h-[58vh] max-[899px]:min-h-[360px]">
          {stage}
        </div>
        <div className="min-h-0 min-w-0 max-[899px]:order-2">{inspector}</div>
      </div>
      <div className="max-[899px]:hidden">{status}</div>
    </div>
  );
}

/** The top bar's container: one row; below 900 px it wraps. */
export function TopBar({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <header
      aria-label={label}
      className="border-border bg-surface flex min-h-[52px] min-w-0 items-center gap-1.5 border-b px-2.5 max-[899px]:flex-wrap max-[899px]:gap-x-1 max-[899px]:gap-y-1.5 max-[899px]:py-2"
    >
      {children}
    </header>
  );
}

export interface RailItem {
  id: RailId;
  icon: IconName;
  label: string;
}

/** The icon rail: a column on a desktop, a sticky row of tools below 900 px. */
export function Rail({
  items,
  active,
  onPick,
  label,
}: {
  items: RailItem[];
  active: RailId | null;
  onPick: (id: RailId) => void;
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="border-border bg-surface flex h-full flex-col gap-0.5 overflow-y-auto border-e px-1.5 py-2 max-[899px]:sticky max-[899px]:top-0 max-[899px]:z-10 max-[899px]:h-auto max-[899px]:flex-row max-[899px]:overflow-x-auto max-[899px]:border-y max-[899px]:border-e-0"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={active === item.id}
          aria-controls={active === item.id ? "studio-asset-panel" : undefined}
          onClick={() => onPick(item.id)}
          className={cn(
            "focus-visible:ring-focus-ring flex shrink-0 flex-col items-center gap-[3px] rounded-lg px-0.5 py-2 text-[10.5px] leading-tight outline-none focus-visible:ring-2 max-[899px]:min-w-[58px]",
            active === item.id
              ? "bg-primary-subtle text-primary-subtle-fg"
              : "text-muted hover:bg-surface-subtle hover:text-fg",
          )}
        >
          <Icon name={item.icon} size={20} aria-hidden="true" />
          <span className="text-center">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

/** The asset panel beside the rail. */
export function AssetPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      id="studio-asset-panel"
      aria-label={title}
      aria-live="polite"
      className="border-border bg-surface flex h-full min-w-0 flex-col gap-3.5 overflow-y-auto border-e p-3.5 max-[899px]:h-auto max-[899px]:border-e-0"
    >
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** The inspector: ออกแบบ · ตรวจงาน (findings) · สั่งผลิต — the same three steps as the top bar. */
export function Inspector({
  tab,
  onTab,
  blocking,
  advice,
  children,
}: {
  tab: ShellStep;
  onTab: (tab: ShellStep) => void;
  blocking: number;
  advice: number;
  children: React.ReactNode;
}) {
  const t = useTranslations("designer.shell.steps");
  const tabs = ["design", "check", "order"] as const;
  return (
    <aside
      aria-label={t("inspector")}
      className="border-border bg-surface flex h-full min-h-0 flex-col border-s max-[899px]:h-auto max-[899px]:border-s-0 max-[899px]:border-t"
    >
      <div role="tablist" aria-label={t("inspector")} className="border-border flex border-b px-2">
        {tabs.map((value) => (
          <button
            key={value}
            id={`studio-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={tab === value}
            aria-controls="studio-tabpanel"
            tabIndex={tab === value ? 0 : -1}
            onClick={() => onTab(value)}
            onKeyDown={(e) => {
              const i = tabs.indexOf(value);
              const next =
                e.key === "ArrowRight" ? tabs[(i + 1) % 3] : e.key === "ArrowLeft" ? tabs[(i + 2) % 3] : null;
              if (next) {
                e.preventDefault();
                onTab(next);
                document.getElementById(`studio-tab-${next}`)?.focus();
              }
            }}
            className={cn(
              "focus-visible:ring-focus-ring inline-flex flex-1 items-center justify-center gap-1.5 border-b-2 px-1.5 pt-3 pb-2.5 text-[13px] font-semibold whitespace-nowrap outline-none focus-visible:ring-2",
              tab === value ? "border-fg text-fg" : "text-muted hover:text-fg border-transparent",
            )}
          >
            {t(value)}
            {value === "check" ? <IssueBadge blocking={blocking} advice={advice} /> : null}
          </button>
        ))}
      </div>
      <div
        id="studio-tabpanel"
        role="tabpanel"
        aria-labelledby={`studio-tab-${tab}`}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3.5"
      >
        {children}
      </div>
    </aside>
  );
}
