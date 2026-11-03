import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AgentPage } from "@/features/agent/AgentPage";
import { getAgentQuote, getDiscountRequests, getPlaybook } from "@/features/agent/api.server";
import { requireActiveAgent } from "@/features/agent/context.server";
import { DiscountFlow } from "@/features/agent/discount/DiscountFlow";
import { PlaybookCard } from "@/features/agent/playbook/PlaybookCard";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agentSales.discount");
  return { title: t("pageTitle") };
}

/**
 * Asking getpack for a discount on one quote (D-468 §3): the three-step form with the playbook's discount cards
 * beside it. One open round at a time; a new round needs a different give-get (the API says so if it does not).
 */
export default async function Page({ params }: { params: Promise<{ agentQuoteId: string }> }) {
  await requireActiveAgent();
  const { agentQuoteId } = await params;
  const quote = await getAgentQuote(agentQuoteId);
  if (!quote) notFound();
  const [t, rounds, cards] = await Promise.all([
    getTranslations("agentSales.discount"),
    getDiscountRequests(quote.id),
    getPlaybook("discount_request"),
  ]);
  const live = quote.status === "sent" || quote.status === "opened";
  const waiting = rounds.some((round) => round.status === "open" || round.status === "offered");
  const back = { href: `/quotes/${quote.id}`, label: t("backToQuote") };
  if (!live || waiting) {
    return (
      <AgentPage title={t("pageTitle")} back={back}>
        <EmptyState
          icon={waiting ? "hourglass" : "archive"}
          title={waiting ? t("alreadyOpen") : t("quoteClosed")}
          description={waiting ? t("alreadyOpenBody") : undefined}
          action={
            <Button asChild variant="secondary">
              <Link href={back.href}>{back.label}</Link>
            </Button>
          }
        />
      </AgentPage>
    );
  }
  const specific = cards.filter((card) => !card.contexts.includes("all"));
  const largest = quote.quote.options.at(-1);
  return (
    <AgentPage
      title={t("pageTitle")}
      intro={t("pageIntro", { name: quote.lead.contactName })}
      back={back}
    >
      <DiscountFlow
        agentQuoteId={quote.id}
        quantity={largest?.quantity ?? 0}
        previous={rounds.length > 0}
        aside={
          <div className="flex flex-col gap-3 lg:sticky lg:top-20">
            {specific.slice(0, 2).map((card, index) => (
              <PlaybookCard key={card.id} card={card} compact={index > 0 ? true : "phone"} />
            ))}
          </div>
        }
      />
    </AgentPage>
  );
}
