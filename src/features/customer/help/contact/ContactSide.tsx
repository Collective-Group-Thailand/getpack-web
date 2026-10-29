import { getLocale, getTranslations } from "next-intl/server";

import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { QRCode } from "@/ui/components/QRCode";
import { Icon, type IconName } from "@/ui/icons";

/**
 * /contact's side column (business pack Phase 2 item 5): the LINE OA card — the QR is drawn from the real add-friend
 * link of the configured OA id —, the other channels and the company's legal details, all from one source (the
 * contact config `storefront.support_channels` and the entity settings via `PublicConfigDto.issuer`, D-458). A row
 * or card without a value is not drawn — never a placeholder.
 */
export async function ContactSide({
  channels,
  issuer,
}: {
  channels: Schemas["StoreSupportChannelsDto"] | null;
  issuer: Schemas["IssuerDto"] | null;
}) {
  const [t, locale] = await Promise.all([getTranslations("help.contact.side"), getLocale()]);
  const lineUrl = channels?.lineOaId ? `https://line.me/R/ti/p/${encodeURIComponent(channels.lineOaId)}` : null;
  const rows: { key: string; icon: IconName; label: string; value: React.ReactNode }[] = [
    ...(channels?.email
      ? [
          {
            key: "email",
            icon: "mail" as const,
            label: t("email"),
            value: (
              <a href={`mailto:${channels.email}`} className="text-primary underline-offset-4 hover:underline">
                {channels.email}
              </a>
            ),
          },
        ]
      : []),
    ...(channels?.phone
      ? [
          {
            key: "phone",
            icon: "phone" as const,
            label: t("phone"),
            value: (
              <a
                href={`tel:${channels.phone.replace(/[^\d+]/g, "")}`}
                className="text-primary tabular-nums underline-offset-4 hover:underline"
              >
                {channels.phone}
              </a>
            ),
          },
        ]
      : []),
    ...(channels?.office
      ? [{ key: "office", icon: "map-pin" as const, label: t("office"), value: channels.office }]
      : []),
  ];
  const name = locale === "en" ? (issuer?.legalNameEn ?? issuer?.legalNameTh) : issuer?.legalNameTh;
  const company = [
    ...(name ? [t("operator", { name })] : []),
    ...(issuer?.taxId
      ? [
          `${t("taxId", { taxId: issuer.taxId })}${
            issuer.branchCode
              ? ` · ${issuer.branchCode === "00000" ? t("headOffice") : t("branch", { code: issuer.branchCode })}`
              : ""
          }`,
        ]
      : []),
    ...(issuer?.addressTh ? [t("address", { address: issuer.addressTh })] : []),
  ];
  return (
    <>
      {lineUrl ? (
        <section aria-labelledby="contact-line" className="border-border bg-success-subtle/50 rounded-panel border p-5">
          <h2 id="contact-line" className="flex items-center gap-2 text-[15px] font-semibold">
            <Icon name="chat" size={18} aria-hidden="true" className="text-success" />
            {t("lineTitle")}
          </h2>
          <div className="mt-3 grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3.5">
            <QRCode value={lineUrl} size={104} label={t("qrLabel")} className="rounded-thumb" />
            <div className="flex flex-col items-start gap-2.5">
              <p className="text-muted text-[13.5px]">
                {channels?.hours ? t("lineHours", { hours: channels.hours }) : t("lineBody")}
              </p>
              <Button asChild size="sm" iconStart="user-plus">
                <a href={lineUrl} target="_blank" rel="noopener noreferrer">
                  {t("addFriend")}
                </a>
              </Button>
            </div>
          </div>
        </section>
      ) : null}
      {rows.length > 0 ? (
        <section aria-labelledby="contact-channels" className="border-border bg-surface rounded-panel border p-5">
          <h2 id="contact-channels" className="text-[15px] font-semibold">
            {t("channelsTitle")}
          </h2>
          <dl className="mt-2">
            {rows.map((row) => (
              <div key={row.key} className="border-border border-t py-3 first:border-t-0">
                <dt className="flex items-center gap-1.5 text-sm font-semibold">
                  <Icon name={row.icon} size={15} aria-hidden="true" />
                  {row.label}
                </dt>
                <dd className="text-muted mt-0.5 text-[13.5px] break-words">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {company.length > 0 ? (
        <section aria-labelledby="contact-company" className="border-border bg-surface rounded-panel border p-5">
          <h2 id="contact-company" className="text-[15px] font-semibold">
            {t("companyTitle")}
          </h2>
          <ul className="text-muted mt-2 flex flex-col gap-1 text-[13.5px] tabular-nums">
            {company.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
