"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";

/**
 * The home page's newsletter (F3 page patterns §Home 8): an e-mail and an unticked PDPA consent box,
 * nothing sent without both. No coupon is promised — one appears only with a real campaign (D-181).
 * CONTRACT-REQUEST store.newsletter-subscribe.
 */
export function NewsletterForm() {
  const t = useTranslations("home.newsletter");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || !consent) return;
    setState("busy");
    setProblem(null);
    try {
      // The request client loads on submit, not with the home page.
      const { browserRequests } = await import("@/lib/api/requests/browser");
      await browserRequests().call("POST /v1/store/newsletter/actions/subscribe", {
        body: { email, marketingConsent: true },
      });
      setState("done");
    } catch (error) {
      setProblem(isApiError(error) ? error.detail : t("failed"));
      setState("idle");
    }
  }

  if (state === "done") return <Callout tone="success" title={t("done")} className="mt-5.5" />;
  return (
    <form
      onSubmit={(event) => void submit(event)}
      aria-label={t("heading")}
      className="mt-5.5 flex flex-col gap-3.5"
      noValidate
    >
      {/* The board's closing row: a kraft-underlined address field and a pill beside it. */}
      <div className="flex flex-col items-end gap-4 sm:flex-row">
        <Field label={t("email")} className="min-w-0 flex-1">
          <Input
            type="email"
            autoComplete="email"
            placeholder={t("placeholder")}
            className="focus-visible:border-primary h-12 rounded-none border-0 border-b-[1.5px] border-[var(--kraft-3)] bg-transparent px-0.5 text-lg shadow-none focus-visible:ring-0"
            value={email}
            onChange={(event) => setEmail(event.target.value.trim())}
          />
        </Field>
        <Button
          type="submit"
          size="lg"
          shape="pill"
          loading={state === "busy"}
          disabled={!valid || !consent}
        >
          {t("subscribe")}
        </Button>
      </div>
      <Checkbox
        checked={consent}
        onCheckedChange={(next) => setConsent(next === true)}
        className="text-muted"
        label={
          <>
            {t("consent")}{" "}
            <Link href="/legal/privacy" className="text-primary underline underline-offset-4">
              {t("privacy")}
            </Link>
          </>
        }
      />
      {problem ? <Callout tone="danger" title={problem} /> : null}
    </form>
  );
}
