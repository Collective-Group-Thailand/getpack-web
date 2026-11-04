"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link, useRouter } from "@/i18n/navigation";
import { browserRequests } from "@/lib/api/requests/browser";
import type { DataRefresh } from "@/lib/api/requests/store-loyalty-p2";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

/**
 * The yearly "is this still right" confirmation (loyalty P2, D-490): a read-only summary of the company, tax profiles
 * and addresses, each block with its "แก้ไข" link, and one "ยืนยันว่าข้อมูลถูกต้อง". The reward line is the API's
 * `rewardPoints` (0 when already paid within 12 months or the cap is used up — then no reward line). Confirming early
 * is allowed and only stamps the date.
 */
export function DataRefreshView({ initial }: { initial: DataRefresh }) {
  const t = useTranslations("account.confirmData");
  const format = useFormat();
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    setSaving(true);
    try {
      const reward = data.rewardPoints;
      const next = await browserRequests().call("POST /v1/store/loyalty/data-refresh/actions/confirm", {
        body: { confirmed: true },
      });
      setData(next);
      toast.success(reward > 0 ? t("confirmedReward", { points: format.number(reward) }) : t("confirmed"));
      router.refresh();
    } catch {
      toast.error(t("failed"));
    } finally {
      setSaving(false);
    }
  };

  const block = (id: string, title: string, href: string, children: React.ReactNode) => (
    <section aria-labelledby={id} className="border-border px-5 py-4 not-first:border-t md:px-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-[0.9375rem] font-semibold">
          {title}
        </h2>
        <Link href={href} className="text-primary text-sm font-medium underline-offset-4 hover:underline">
          {t("edit")}
        </Link>
      </div>
      <div className="mt-2 text-sm">{children}</div>
    </section>
  );

  return (
    <div className="flex flex-col gap-4">
      {!data.due && data.lastConfirmedAt ? (
        <p className="bg-success-subtle text-success-subtle-fg rounded-card flex items-start gap-2.5 px-4 py-3 text-sm">
          <Icon name="check" size={18} aria-hidden="true" className="mt-px shrink-0" />
          <span>
            {t("upToDate", { date: format.date(data.lastConfirmedAt) })}
            {data.nextDueAt ? ` · ${t("nextDue", { date: format.date(data.nextDueAt) })}` : null}
          </span>
        </p>
      ) : null}

      <div className="border-border bg-surface rounded-panel overflow-hidden border">
        {data.company
          ? block("confirm-company", t("company"), "/business", <p className="font-medium">{data.company.legalName}</p>)
          : null}
        {block(
          "confirm-tax",
          t("taxProfiles"),
          "/account/addresses#book-tax",
          data.taxProfiles.length ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {data.taxProfiles.map((profile) => (
                <li key={profile.id}>{profile.label}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">{t("none")}</p>
          ),
        )}
        {block(
          "confirm-addresses",
          t("addresses"),
          "/account/addresses#book-addresses",
          data.addresses.length ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {data.addresses.map((address) => (
                <li key={address.id} className="flex items-center gap-2">
                  {address.label}
                  {address.isDefault ? <Badge size="sm">{t("default")}</Badge> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">{t("none")}</p>
          ),
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted text-sm">
          {data.rewardPoints > 0
            ? t.rich("reward", {
                points: format.number(data.rewardPoints),
                b: (chunk) => <b className="text-primary-subtle-fg font-semibold">{chunk}</b>,
              })
            : t("noReward")}
        </p>
        <Button loading={saving} onClick={() => void confirm()}>
          {data.due ? t("confirm") : t("confirmAgain")}
        </Button>
      </div>
    </div>
  );
}
