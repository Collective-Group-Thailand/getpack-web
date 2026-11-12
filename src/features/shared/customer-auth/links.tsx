import { Link } from "@/i18n/navigation";

/**
 * Where sign-in's "terms", "privacy" and "talk to us" go. On the storefront they are its own pages (locale-aware);
 * getpack Agent (D-467) has no such pages, so it passes the storefront's absolute URLs and they open in a new tab.
 */
export interface SignInLinks {
  help: string;
  terms: string;
  privacy: string;
}

export const STOREFRONT_SIGN_IN_LINKS: SignInLinks = {
  help: "/help/contact",
  terms: "/legal/terms",
  privacy: "/legal/privacy",
};

export function SignInLink({
  href,
  className,
  newTab,
  children,
}: {
  href: string;
  className?: string;
  newTab?: boolean;
  children: React.ReactNode;
}) {
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} target={newTab ? "_blank" : undefined}>
      {children}
    </Link>
  );
}
