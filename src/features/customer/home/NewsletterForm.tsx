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
      {/* On the home page's dark band: one translucent pill holding the address and the button. */}
      <div className="border-fg-inverse/15 bg-fg-inverse/10 flex flex-col gap-2 rounded-2xl border p-1.5 sm:flex-row">
        <Field label={t("email")} labelHidden className="min-w-0 flex-1">
          <Input
            type="email"
            autoComplete="email"
            placeholder={t("placeholder")}
            className="text-fg-inverse placeholder:text-fg-inverse/60 h-11.5 border-0 bg-transparent px-3 text-base"
            value={email}
            onChange={(event) => setEmail(event.target.value.trim())}
          />
        </Field>
        <Button
          type="submit"
          size="lg"
          className="h-11.5 rounded-xl"
          loading={state === "busy"}
          disabled={!valid || !consent}
        >
          {t("subscribe")}
        </Button>
      </div>
      <Checkbox
        checked={consent}
        onCheckedChange={(next) => setConsent(next === true)}
        className="text-fg-inverse/75"
        label={
          <>
            {t("consent")}{" "}
            <Link href="/legal/privacy" className="text-fg-inverse underline underline-offset-4">
              {t("privacy")}
            </Link>
          </>
        }
      />
      {problem ? <Callout tone="danger" title={problem} /> : null}
    </form>
  );
}
