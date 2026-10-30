"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { RequestCallOffDialog } from "@/features/customer/repeat/RequestCallOff";
import { RequestSampleDialog } from "@/features/customer/samples/RequestSample";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { DropdownMenu, type MenuItem } from "@/ui/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";

/**
 * A saved quotation's actions on one line (Project B2 fix): "เปิดอีกครั้ง" is the one visible button; asking
 * for a sample and locking the price for call-offs sit in a "⋯" menu that opens their dialogs — so every
 * row is one line tall, whatever it offers.
 */
export function QuoteRowActions({
  quoteId,
  optionId,
  label,
  canSample,
  reopenHref,
}: {
  quoteId: string;
  /** The option to lock for call-offs; none when the quotation cannot be locked. */
  optionId: string | null;
  /** The quotation's code or product name, for the screen reader. */
  label: string;
  canSample: boolean;
  reopenHref: string | null;
}) {
  const t = useTranslations("account.quotes");
  const tSample = useTranslations("myOrders.samples.request");
  const tCallOff = useTranslations("account.callOffs.request");
  const [sample, setSample] = useState(false);
  const [callOff, setCallOff] = useState(false);

  const items: MenuItem[] = [
    ...(canSample
      ? [{ id: "sample", label: tSample("open"), icon: "package-check" as const, onSelect: () => setSample(true) }]
      : []),
    ...(optionId
      ? [{ id: "call-off", label: tCallOff("open"), icon: "calendar" as const, onSelect: () => setCallOff(true) }]
      : []),
  ];

  return (
    <span className="flex items-center justify-end gap-1.5 whitespace-nowrap">
      {reopenHref ? (
        <Button asChild size="sm" variant="secondary">
          <Link href={reopenHref}>
            {t("reopen")}
            <span className="sr-only"> {label}</span>
          </Link>
        </Button>
      ) : null}
      {items.length > 0 ? (
        <DropdownMenu
          label={t("moreActions", { label })}
          items={items}
          trigger={<IconButton name="more" size="sm" variant="ghost" label={t("moreActions", { label })} />}
        />
      ) : null}
      {canSample ? <RequestSampleDialog quoteId={quoteId} open={sample} onOpenChange={setSample} /> : null}
      {optionId ? (
        <RequestCallOffDialog quoteId={quoteId} optionId={optionId} open={callOff} onOpenChange={setCallOff} />
      ) : null}
    </span>
  );
}
