import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";

/** The places an empty or dead-end state can always send someone (U5.1 §3 "zero dead ends"). */
export const NEXT_STEPS = {
  home: "/",
  products: "/products",
  search: "/search",
  help: "/help",
  chat: "/help/chat",
  orders: "/account/orders",
  messages: "/account/messages",
  styles: "/styles",
  learn: "/learn",
} as const;

export type NextStepKey = keyof typeof NEXT_STEPS;

/**
 * One next action as a button-link, labelled from `common.next` (works in server and client
 * components). `href` overrides the destination when the step is about a particular record.
 */
export function NextStep({
  to,
  href,
  variant = "primary",
}: {
  to: NextStepKey;
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const t = useTranslations("common.next");
  return (
    <Button asChild variant={variant}>
      <Link href={href ?? NEXT_STEPS[to]}>{t(to)}</Link>
    </Button>
  );
}
