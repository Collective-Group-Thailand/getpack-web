import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { addressLine } from "@/features/partner/address";
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
 * Carton labels, 100 × 150 mm, one per carton (B4.3): the shipment and carton numbers, the
 * recipient (D-142), and a QR of the public tracking link — no price, no customer beyond that.
 */
export default async function LabelsPage({ params }: Props) {
  const { shipmentId } = await params;
  const t = await getTranslations("partnerShip.labels");
  const format = await getFormat();
  const context = await factoryContext();
  const { requests } = await partnerServerApis();
  const found = await attempt(() =>
    requests.call("GET /v1/partner/factories/{factoryId}/shipments/{shipmentId}", {
      path: { factoryId: context.factoryId, shipmentId },
    }),
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
  // The label stock this device prints on (settings), 100 × 150 mm unless set otherwise.
  const size = (await cookies()).get("pk_label")?.value === "4x6" ? "4x6" : "100x150";

  return (
    <PartnerPage title={t("title")} back={back} description={t("body")} actions={<PrintButton label={t("print")} />}>
      <LabelSheet
        size={size}
        label={t("sheet", { no: shipment.shipmentNo })}
        labels={shipment.cartonList.map((carton) => (
          <div key={carton.seq} className="flex h-full flex-col gap-[2mm] text-[11pt] leading-snug">
            <p className="font-mono text-[16pt] font-bold">{carton.labelCode}</p>
            <p className="font-semibold">{t("carton", { n: carton.seq, total: shipment.cartonList.length })}</p>
            <p className="text-[10pt]">{t("job", { jobNo: shipment.job.jobNo, title: shipment.job.title })}</p>
            <hr className="border-black" />
            <p className="text-[9pt] font-semibold">{t("to")}</p>
            <p className="text-[14pt] font-bold">{destination.recipientName}</p>
            <p>{addressLine({ ...destination, line1: destination.address })}</p>
            <p className="font-semibold">{destination.phone}</p>
            {carton.weightG ? (
              <p className="text-[9pt]">{t("weight", { kg: format.number(carton.weightG / 1000) })}</p>
            ) : null}
            <div className="mt-auto flex items-end justify-between gap-[3mm]">
              <p className="text-[8pt]">{t("scan")}</p>
              <QRCode value={carton.trackingUrl} size="38mm" label={t("qr", { n: carton.seq })} />
            </div>
          </div>
        ))}
      />
    </PartnerPage>
  );
}
