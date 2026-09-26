"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

/** Copies a code or a link, and says so; on a phone it offers the share sheet instead. */
export function CopyButton({ value, label, share }: { value: string; label: string; share?: { title: string } }) {
  const t = useTranslations("account.copy");
  return (
    <Button
      size="sm"
      variant="secondary"
      iconStart={share ? "link" : "copy"}
      onClick={async () => {
        if (share && typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
          await navigator.share({ title: share.title, url: value }).catch(() => undefined);
          return;
        }
        await navigator.clipboard?.writeText(value).catch(() => undefined);
        toast.success(t("copied"));
      }}
    >
      {label}
    </Button>
  );
}
