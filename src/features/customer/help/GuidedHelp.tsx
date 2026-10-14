"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { CallInit, ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { RadioCards } from "@/ui/components/RadioCards";

import { CsHandoff } from "./CsHandoff";

type Answers = CallInit<Requests, "POST /v1/store/guided-help/actions/recommend">["body"];
type Recommendation = ResponseOf<Requests, "POST /v1/store/guided-help/actions/recommend">;

const USES = ["cosmetics", "food", "electronics", "apparel", "gifts", "other"] as const;
const SIZES = ["small", "medium", "large", "unsure"] as const;
const QUANTITIES = ["under_500", "500_2000", "2000_10000", "over_10000"] as const;
const PRIORITIES = ["premium", "protection", "budget", "eco"] as const;

/**
 * Guided help (F3 3.7): four questions, styles recommended with a reason each, and a hand-off to
 * a person that carries everything already said — the page, the answers, the styles shown — so
 * the customer never repeats it (`store.support.handoff`, through `CsHandoff`).
 *
 * The recommendation is still a contract request: guided help waits for the Structure Advisor
 * (U2.2, D-223), so nothing mounts this until then — the storefront offers the hand-off alone.
 */
export function GuidedHelp({
  headingLevel = "h2",
  signedIn = false,
}: {
  headingLevel?: "h2" | "h3";
  signedIn?: boolean;
}) {
  const t = useTranslations("help.guided");
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [result, setResult] = useState<Recommendation | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState<"recommend" | null>(null);
  const Heading = headingLevel;
  const complete = Boolean(answers.use && answers.size && answers.quantity && answers.priority);

  async function recommend() {
    if (!complete) return;
    setBusy("recommend");
    setFailure(null);
    try {
      setResult(
        await browserRequests().call("POST /v1/store/guided-help/actions/recommend", { body: answers as Answers }),
      );
    } catch (error) {
      setFailure(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(null);
    }
  }

  const question = (name: keyof Answers, values: readonly string[], columns: 2 | 3 = 2) => (
    <Field label={t(`questions.${name}`)}>
      <RadioCards
        columns={columns}
        value={answers[name] as string | undefined}
        onValueChange={(value) => {
          setAnswers((current) => ({ ...current, [name]: value }));
          setResult(null);
        }}
        options={values.map((value) => ({ value, label: t(`options.${name}.${value}`) }))}
      />
    </Field>
  );

  return (
    <div className="flex flex-col gap-5">
      {question("use", USES, 3)}
      {question("size", SIZES)}
      {question("quantity", QUANTITIES)}
      {question("priority", PRIORITIES)}
      <Button
        onClick={() => void recommend()}
        disabled={!complete}
        loading={busy === "recommend"}
        className="self-start"
      >
        {t("recommend")}
      </Button>
      {failure ? (
        <Callout tone="danger" role="alert">
          {failure}
        </Callout>
      ) : null}

      {result ? (
        <section aria-labelledby="guided-result" aria-live="polite" className="flex flex-col gap-3">
          <Heading id="guided-result" className="font-semibold">
            {t("resultTitle", { summary: result.summary })}
          </Heading>
          <ul className="flex flex-col gap-2">
            {result.styles.map((style) => (
              <li key={style.slug} className="bg-surface border-border flex gap-3 rounded-lg border p-3">
                {style.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- catalogue image from the API
                  <img src={style.imageUrl} alt="" className="size-16 shrink-0 rounded object-cover" />
                ) : null}
                <div className="min-w-0">
                  <Link
                    href={`/configure/${style.slug}`}
                    className="text-primary font-medium underline underline-offset-4"
                  >
                    {style.name}
                  </Link>
                  <p className="text-muted text-sm">{style.why}</p>
                  {style.fromUnitPrice ? <p className="text-sm">{t("from", { price: style.fromUnitPrice })}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <CsHandoff
        signedIn={signedIn}
        headingLevel={headingLevel}
        context={{
          ...(complete ? { answers: answers as Record<string, unknown> } : {}),
          ...(result ? { recommended: result.styles.map((style) => style.slug) } : {}),
        }}
      />
    </div>
  );
}
