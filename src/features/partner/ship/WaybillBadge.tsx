import { Badge } from "@/ui/components/Badge";

/**
 * Whether getpack has issued the carrier's waybill for a trip (D-462, `PartnerShipmentDto.waybillIssued`): a driver
 * handover link or a fallback-carrier booking. The recipient's name, phone and address travel on that waybill to
 * the carrier only — the factory learns nothing but this yes / no.
 */
export function WaybillBadge({ issued, labels }: { issued: boolean; labels: { issued: string; pending: string } }) {
  return (
    <Badge tone={issued ? "success" : "neutral"} icon={issued ? "file-check" : "document"}>
      {issued ? labels.issued : labels.pending}
    </Badge>
  );
}
