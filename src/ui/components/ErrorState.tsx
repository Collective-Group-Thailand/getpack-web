import { Icon } from "../icons";
import { cn } from "../lib/cn";
import { ReferenceCode } from "./ReferenceCode";

export interface ErrorStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Retry, or anything else that gets the user out of here. */
  action?: React.ReactNode;
  /**
   * The request id, shown small as a short reference (`PK-88F013`) with a copy button that puts
   * the full id on the clipboard (design-system.md §4; the UUID itself is never displayed).
   */
  code?: string;
  /** "รหัสอ้างอิง" and the copy button's names, from the caller's translations. */
  codeLabels?: { label: string; copy: string; copied: string };
}

/**
 * A failed region — specific and recoverable, never a dead end. `role="alert"` so a screen
 * reader hears it when it replaces the content that was loading.
 */
export function ErrorState({ title, description, action, code, codeLabels, className, ...props }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "border-danger/25 bg-danger-subtle flex flex-col items-center justify-center gap-3 rounded-xl border px-6 py-10 text-center",
        className,
      )}
      {...props}
    >
      <Icon name="danger" size={28} className="text-danger-subtle-fg" />
      <p className="text-danger-subtle-fg text-lg font-medium">{title}</p>
      {description ? <p className="text-danger-subtle-fg/90 max-w-prose text-sm">{description}</p> : null}
      {action ? <div className="mt-2 flex items-center gap-2">{action}</div> : null}
      {code ? (
        <ReferenceCode
          id={code}
          label={codeLabels?.label}
          copyLabel={codeLabels?.copy}
          copiedLabel={codeLabels?.copied}
          className="mt-1"
        />
      ) : null}
    </div>
  );
}
