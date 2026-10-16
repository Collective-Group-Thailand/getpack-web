import { getTranslations } from "next-intl/server";

import { When } from "@/features/shared/format";
import { Link } from "@/i18n/navigation";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";

/**
 * A claim's clock (U2.F4, D-263): who must act now — getpack, the customer (information asked for;
 * getpack's clock stops), the factory, or nobody — the time getpack answers and decides by, overdue
 * when the API says so, and every step so far. The guarantee version it follows links to the page.
 */
export async function ClaimTimeline({ timeline }: { timeline: Schemas["ClaimTimelineDto"] }) {
  const t = await getTranslations("fulfilment.claimTimeline");
  const { sla } = timeline;
  return (
    <section aria-labelledby="claim-timeline" className="flex flex-col gap-4">
      <h2 id="claim-timeline" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <Callout tone={sla.currentOwner === "customer" ? "warning" : "info"} title={t(`owner.${sla.currentOwner}`)}>
        <ul className="flex flex-col gap-1 text-sm">
          {sla.responseDueAt && !sla.respondedAt ? (
            <li>
              {t("responseDue")} <When at={sla.responseDueAt} />{" "}
              {sla.responseOverdue ? <Badge tone="danger">{t("overdue")}</Badge> : null}
            </li>
          ) : sla.respondedAt ? (
            <li>
              {t("responded")} <When at={sla.respondedAt} absoluteOnly />
            </li>
          ) : null}
          {sla.decisionDueAt ? (
            <li>
              {t("decisionDue")} <When at={sla.decisionDueAt} />{" "}
              {sla.decisionOverdue ? <Badge tone="danger">{t("overdue")}</Badge> : null}
            </li>
          ) : sla.currentOwner === "customer" ? (
            <li>{t("clockStopped")}</li>
          ) : null}
        </ul>
      </Callout>
      <ol className="border-border flex flex-col gap-3 border-s-2 ps-4">
        {timeline.events.map((event, i) => (
          <li key={`${event.type}-${i}`} className="text-sm">
            <span className="font-medium">{t(`events.${event.type.replace("claim.", "")}`)}</span>{" "}
            <span className="text-muted">
              <When at={event.at} absoluteOnly />
            </span>
          </li>
        ))}
      </ol>
      {sla.guaranteeVersionNo ? (
        <p className="text-muted text-xs">
          <Link href="/guarantee" className="text-primary underline underline-offset-4">
            {t("guarantee", { version: sla.guaranteeVersionNo })}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
