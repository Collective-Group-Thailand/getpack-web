import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { prefixOf, shipmentCodeOf } from "@/features/partner/ship/destination";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { PrintButton } from "@/features/partner/ship/actions";
import { getFormat } from "@/features/shared/format/server";
import { LabelSheet } from "@/ui/components/LabelSheet";
import { QRCode } from "@/ui/components/QRCode";

type Props = { params: Promise<{ shipmentId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerShip.labels"))("title") };
}

/**
 * Carton labels, 100 × 150 mm, one per carton (B4.3), drawn from the packed trip's `cartons[]` with the content of
 * getpack-api's labels PDF (D-463, sealed carrier label): getpack as sender, the shipment code, the job, the
 * destination code within the job (`D1` …) with its province and postcode prefix, carton n/m and a QR — never the
 * recipient's name, phone or address, which travel on the carrier's waybill only. The API's own PDF opens from the trip.
 *
 * CONTRACT-GAP partner.shipments — the partner trip leaves out the public tracking URL the PDF's QR encodes (its
 * token is stored hashed), so this preview's QR carries the label code the factory's scanner resolves.
 */
export default async function LabelsPage({ params }: Props) {
  const { shipmentId } = await params;
  const [t, format] = await Promise.all([getTranslations("partnerShip.labels"), getFormat()]);
  await factoryContext();
  const { contract } = await partnerServerApis();
  const found = await attempt(
    async () => (await contract.GET("/v1/partner/shipments/{shipmentId}", { params: { path: { shipmentId } } })).data!,
  );
  const back = { href: `/ship/${shipmentId}`, label: t("back") };
  if (!found.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={found.error} />
      </PartnerPage>
    );
  const shipment = found.data;
  const { destination } = shipment;
  const jobNos = [...new Set(shipment.items.map((item) => item.jobNo))].join(", ");
  const code = shipmentCodeOf(shipment);
  const prefix = prefixOf(destination);
  // The label stock this device prints on (settings), 100 × 150 mm unless set otherwise.
  const size = (await cookies()).get("pk_label")?.value === "4x6" ? "4x6" : "100x150";

  return (
    <PartnerPage title={t("title")} back={back} description={t("body")} actions={<PrintButton label={t("print")} />}>
      {shipment.cartons.length ? (
        <LabelSheet
          size={size}
          label={t("sheet", { no: shipment.shipmentNo })}
          labels={shipment.cartons.map((carton) => (
            <div key={carton.seq} className="flex h-full flex-col text-[10pt] leading-snug">
              {/* D-463: the label as getpack-api prints it — shipment code, job, the destination code in its
                  box with the province and postcode prefix, getpack as sender, carton n/m — and no recipient. */}
              <div className="flex items-baseline justify-between border-b-[1.5pt] border-black pb-[2mm]">
                <span className="text-[16pt] font-bold">{t("senderName")}</span>
                <span className="font-bold tabular-nums">{shipment.shipmentNo}</span>
              </div>
              <div className="mt-[3mm]">
                <p className="text-[7.5pt] uppercase">{t("jobLabel")}</p>
                <p className="font-bold tabular-nums">{t("job", { jobNo: jobNos })}</p>
              </div>
              <div className="mt-[4mm] flex items-center gap-[4mm]">
                {code ? (
                  <span className="border-[2pt] border-black px-[3mm] text-[30pt] leading-[1.1] font-bold">{code}</span>
                ) : null}
                <div>
                  <p className="text-[7.5pt] uppercase">{t("to")}</p>
                  <p className="text-[13pt] font-bold">{destination.province.nameTh}</p>
                  <p className="tabular-nums">{prefix}</p>
                </div>
              </div>
              <div className="mt-[3mm]">
                <p className="text-[7.5pt] uppercase">{t("sender")}</p>
                <p>{t("senderName")}</p>
              </div>
              <div className="mt-[3mm]">
                <p className="text-[7.5pt] uppercase">{t("waybill")}</p>
                <p>{t("waybillBody")}</p>
              </div>
              <div className="mt-auto flex items-end justify-between gap-[3mm]">
                <div className="flex flex-col gap-[1mm]">
                  <QRCode value={carton.labelCode} size="30mm" label={t("qr", { n: carton.seq })} />
                  <p className="text-[7.5pt]">{t("scan")}</p>
                </div>
                <div className="text-end">
                  <p className="text-[20pt] font-bold tabular-nums">
                    {t("cartonCount", { n: carton.seq, total: shipment.cartons.length })}
                  </p>
                  <p className="text-[9pt] tabular-nums">{carton.labelCode}</p>
                  {carton.weightG ? (
                    <p className="text-[8pt]">{t("weight", { kg: format.number(carton.weightG / 1000) })}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        />
      ) : (
        <p className="text-muted">{t("notPacked")}</p>
      )}
    </PartnerPage>
  );
}
