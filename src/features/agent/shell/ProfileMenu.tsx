"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { signOut } from "@/features/shared/auth/sign-out";
import { Avatar } from "@/ui/components/Avatar";
import { DropdownMenu } from "@/ui/components/DropdownMenu";

import type { AgentNavItem } from "./nav";

/**
 * The header's profile menu (D-467): โปรไฟล์และสัญญา, ข้อมูลรับเงิน, ลดหย่อนภาษี, การแจ้งเตือน, then ออกจากระบบ — which
 * ends this device's getpack Agent session only (host-only cookies; the storefront stays signed in).
 */
export function ProfileMenu({ name, items }: { name: string; items: readonly AgentNavItem[] }) {
  const t = useTranslations("agentZone.nav");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <DropdownMenu
      label={t("profileMenu")}
      heading={name}
      trigger={
        <button
          type="button"
          aria-label={t("profileMenu")}
          className="focus-visible:ring-focus-ring flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-2"
        >
          <Avatar name={name} size="md" />
        </button>
      }
      items={[
        ...items.map((item) => ({
          id: item.key,
          label: t(item.key),
          icon: item.icon,
          onSelect: () => router.push(item.href),
        })),
        {
          id: "sign-out",
          label: tAuth("signOut"),
          icon: "log-out" as const,
          separatorBefore: true,
          onSelect: () => startTransition(() => signOut("agent")),
        },
      ]}
    />
  );
}
