import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

/**
 * No style matches the filters (styles redesign §12): what happened, "ล้างตัวกรองทั้งหมด" to undo
 * it, and "ขอแบบใหม่จากทีม" to the existing structural-request flow (sign-in first for a guest).
 */
export function LibraryEmpty({
  title,
  body,
  clearLabel,
  clearHref,
  requestLabel,
  requestHref,
}: {
  title: string;
  body: string;
  clearLabel: string;
  clearHref: string;
  requestLabel: string;
  requestHref: string;
}) {
  return (
    <EmptyState
      icon="search"
      title={title}
      description={body}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant="secondary">
            <Link href={clearHref} replace>
              {clearLabel}
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href={requestHref}>{requestLabel}</Link>
          </Button>
        </div>
      }
    />
  );
}
