"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";

/** The tracking code from the carton label or the link someone shared, typed in. */
export function TrackForm() {
  const t = useTranslations("fulfilment.track");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    // A pasted link works too: its last path segment is the token.
    const token = code.trim().split("/").filter(Boolean).at(-1) ?? "";
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(token)) {
      setError(t("invalid"));
      return;
    }
    router.push(`/track/${token}`);
  }

  return (
    <form noValidate onSubmit={submit} className="flex max-w-md flex-col gap-3">
      <Field label={t("code")} hint={t("codeHint")} error={error}>
        <Input value={code} autoComplete="off" spellCheck={false} onChange={(event) => setCode(event.target.value)} />
      </Field>
      <Button type="submit" className="self-start" iconStart="search">
        {t("submit")}
      </Button>
    </form>
  );
}
