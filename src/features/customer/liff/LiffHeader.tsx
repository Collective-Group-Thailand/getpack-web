import { Link } from "@/i18n/navigation";
import { Icon } from "@/ui/icons";

/**
 * A LIFF page's head (Project D): the way back as a full-height touch target, the title, and a line of status
 * under it. One size on every LIFF page — LINE's in-app browser has no chrome of its own to lean on.
 */
export function LiffHeader({
  back,
  title,
  children,
}: {
  back?: { href: string; label: string };
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-1.5">
      {back ? (
        <Link
          href={back.href}
          className="text-muted hover:text-fg focus-visible:ring-focus-ring rounded-control -ms-2 inline-flex min-h-11 items-center gap-1 self-start px-2 text-sm font-medium outline-none focus-visible:ring-2"
        >
          <Icon name="chevron-left" size={18} aria-hidden="true" />
          {back.label}
        </Link>
      ) : null}
      <h1 className="text-[1.375rem] leading-tight font-semibold tracking-tight text-balance">{title}</h1>
      {children}
    </header>
  );
}
