"use client";

import { useTranslations } from "next-intl";

import { Tooltip } from "@/ui/components/Tooltip";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import type { EditorTool } from "../../store/mode";

/** The pro toolbox in order, with its single keys (Phase 3 item 1); `null` = a divider. */
export const TOOLBOX: ({ tool: EditorTool; key: string; icon: IconName } | null)[] = [
  { tool: "select", key: "V", icon: "mouse-pointer" },
  { tool: "hand", key: "H", icon: "hand" },
  { tool: "zoom", key: "Z", icon: "zoom-in" },
  null,
  { tool: "text", key: "T", icon: "text" },
  { tool: "rect", key: "R", icon: "square" },
  { tool: "ellipse", key: "E", icon: "circle" },
  { tool: "line", key: "L", icon: "line" },
  { tool: "pen", key: "P", icon: "pen" },
  null,
  { tool: "eyedropper", key: "I", icon: "pipette" },
  { tool: "comment", key: "C", icon: "map-pin" },
];

/**
 * The pro toolbox (Phase 3 item 1): vertical in the stage's top-left corner on a desktop, a horizontal bar above the
 * view bar below 900 px. Each tool has a tooltip with its key; drawing tools revert to "select" after one shape.
 */
export function Toolbox({
  tool,
  onTool,
  comments,
  className,
}: {
  tool: EditorTool;
  onTool: (tool: EditorTool) => void;
  /** The comment pin is offered only where comments are (an account design). */
  comments: boolean;
  className?: string;
}) {
  const t = useTranslations("designer.shell.tools");
  return (
    <div
      role="toolbar"
      aria-label={t("label")}
      aria-orientation="vertical"
      className={cn(
        "border-border bg-surface shadow-overlay flex gap-0.5 rounded-xl border p-1",
        "[scrollbar-width:none] flex-row overflow-x-auto min-[900px]:flex-col min-[900px]:overflow-visible",
        className,
      )}
    >
      {TOOLBOX.filter((item) => item?.tool !== "comment" || comments).map((item, i) =>
        item ? (
          <Tooltip key={item.tool} content={`${t(item.tool)}  ${item.key}`} side="right">
            <button
              type="button"
              aria-pressed={tool === item.tool}
              aria-label={`${t(item.tool)} (${item.key})`}
              aria-keyshortcuts={item.key}
              data-tool={item.tool}
              onClick={() => onTool(item.tool)}
              className={cn(
                "focus-visible:ring-focus-ring grid size-[34px] shrink-0 place-items-center rounded-lg outline-none focus-visible:ring-2",
                tool === item.tool ? "bg-primary text-primary-fg" : "text-muted hover:bg-surface-subtle hover:text-fg",
              )}
            >
              <Icon name={item.icon} size={18} aria-hidden="true" />
            </button>
          </Tooltip>
        ) : (
          <span
            key={`d${i}`}
            aria-hidden="true"
            className="bg-border mx-[3px] my-1 w-px shrink-0 min-[900px]:mx-1 min-[900px]:my-[3px] min-[900px]:h-px min-[900px]:w-auto"
          />
        ),
      )}
    </div>
  );
}
