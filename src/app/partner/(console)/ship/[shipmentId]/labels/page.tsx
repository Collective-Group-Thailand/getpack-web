import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { destinationPlace } from "@/features/partner/ship/destination";
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
 * Carton labels, 100 × 150 mm, one per carton (B4.3), drawn from the packed trip's `cartons[]`:
 * the carton's label code, its number in the trip, the job, the destination as province and postcode prefix
 * (P4-01, P4-D1: no recipient name, phone or address on a label the factory prints) and a QR of the label code. The API's own labels PDF opens from the trip.
 *
 * CONTRACT-GAP partner.shipments — the API leaves out the per-carton public tracking URL (its
 * token is stored hashed), so the QR carries the label code the scanner resolves, not a link.
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
  // The label stock this device prints on (settings), 100 × 150 mm unless set otherwise.
  const size = (await cookies()).get("pk_label")?.value === "4x6" ? "4x6" : "100x150";

  return (
    <PartnerPage title={t("title")} back={back} description={t("body")} actions={<PrintButton label={t("print")} />}>
      {shipment.cartons.length ? (
        <LabelSheet
          size={size}
          label={t("sheet", { no: shipment.shipmentNo })}
          labels={shipment.cartons.map((carton) => (
            <div key={carton.seq} className="flex h-full flex-col gap-[2mm] text-[11pt] leading-snug">
              <p className="text-[16pt] font-bold tabular-nums">{carton.labelCode}</p>
              <p className="font-semibold">{t("carton", { n: carton.seq, total: shipment.cartons.length })}</p>
              <p className="text-[10pt]">{t("job", { jobNo: jobNos })}</p>
              <hr className="border-black" />
              {/* P4-01 / P4-D1: the job, where it goes as province and postcode prefix, the carton — no recipient. */}
              <p className="text-[9pt] font-semibold">{t("to")}</p>
              <p className="text-[14pt] font-bold">
                {destinationPlace(destination.province.nameTh, destination.postcode)}
              </p>
              {carton.weightG ? (
                <p className="text-[9pt]">{t("weight", { kg: format.number(carton.weightG / 1000) })}</p>
              ) : null}
              <div className="mt-auto flex items-end justify-between gap-[3mm]">
                <p className="text-[8pt]">{t("scan")}</p>
                <QRCode value={carton.labelCode} size="38mm" label={t("qr", { n: carton.seq })} />
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
