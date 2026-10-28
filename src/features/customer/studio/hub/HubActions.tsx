"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { storeDesigns } from "@/features/designer/data/api";
import { Link, useRouter } from "@/i18n/navigation";
import { trackStudioHub, type StudioHubEvents } from "@/lib/analytics";
import { browserApi, isApiError } from "@/lib/api/browser";
import { Button, buttonVariants } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { styleHref } from "@/features/customer/styles/paths";

import { studioHref } from "../paths";
import { recipeOfVariant } from "../variant-recipe";

type Path = StudioHubEvents["studio_path"]["path"];

/** A link that counts which way into the studio was taken (`studio_path`, item 9). */
export function PathLink({
  path,
  href,
  className,
  children,
}: {
  path: Path;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => trackStudioHub("studio_path", { path })}>
      {children}
    </Link>
  );
}

/** A button look for a link, picked on the server and drawn here (`buttonVariants` is a client function). */
type Look = Parameters<typeof buttonVariants>[0];

/** "ลองกับแบบตัวอย่าง" — counted (`studio_try_sample`). */
export function SampleLink({ href, look, children }: { href: string; look?: Look; children: React.ReactNode }) {
  return (
    <Link href={href} className={buttonVariants(look)} onClick={() => trackStudioHub("studio_try_sample", {})}>
      {children}
    </Link>
  );
}

/**
 * "มีไฟล์แบบแล้ว" with a real drop zone (item 3): choosing or dropping a file starts the upload flow — the
 * own-file product list, told the file's name. The file itself stays on the customer's computer: it is uploaded on
 * the order's artwork page after ordering (GLOBAL-RULES §6), so nothing is sent from here.
 */
export function FileDrop({ label }: { label: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const start = (file: File | undefined) => {
    trackStudioHub("studio_path", { path: "file" });
    router.push(file ? `/studio/upload?file=${encodeURIComponent(file.name.slice(0, 120))}` : "/studio/upload");
  };
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          start(event.dataTransfer.files[0]);
        }}
        className={cn(
          "rounded-card text-muted focus-visible:ring-focus-ring relative z-10 mt-auto w-full border-[1.5px] border-dashed px-3 py-3 text-center text-[13px] outline-none focus-visible:ring-2",
          over ? "border-primary bg-primary-subtle text-primary" : "border-border-strong hover:border-primary",
        )}
      >
        <Icon name="upload" size={16} aria-hidden="true" className="me-1.5 inline align-[-3px]" />
        {label}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept=".pdf,.ai,.eps,.svg,.png,.jpg,.jpeg,.tif,.tiff,.psd"
        onChange={(event) => start(event.target.files?.[0])}
      />
    </>
  );
}

/**
 * "เปิดในสตูดิโอ" on a featured style (item 6): the style's first published variant, opened like the style page does
 * (`VariantActions`) — on its inside size, or on its own values when it is sized otherwise (C7).
 */
export function OpenStyleButton({
  code,
  productSlug,
  label,
  name,
}: {
  code: string;
  productSlug: string | null;
  label: string;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const open = async () => {
    trackStudioHub("studio_template_open", { style: code });
    setBusy(true);
    try {
      const { data } = await browserApi().GET("/v1/store/styles/{code}", { params: { path: { code } } });
      const variant = data?.variants[0];
      const found = variant ? await recipeOfVariant(code, variant.options) : null;
      if (!variant || !found) {
        router.push(styleHref(code, name));
        return;
      }
      const [l, w, h] = [found.values.length, found.values.width, found.values.height];
      const boxed = typeof l === "number" && typeof w === "number" && typeof h === "number";
      router.push(
        studioHref({
          product: productSlug,
          style: found.recipe.id,
          dims: boxed ? { l, w, h } : null,
          variant: { base: code, code: variant.code, key: found.key },
          step: "box",
        }),
      );
    } catch {
      router.push(styleHref(code, name));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={busy}
      aria-label={`${label} · ${name}`}
      className="text-primary mt-2 inline-flex items-center gap-1 text-[13px] font-semibold outline-none after:absolute after:inset-0 focus-visible:underline disabled:opacity-60"
    >
      {label}
      <Icon name="arrow-right" size={14} aria-hidden="true" />
    </button>
  );
}

/** "ทำสำเนา" on a recent design (item 7) — the account's copy, as on "แบบของฉัน". */
export function DuplicateDesign({ id, name }: { id: string; name: string }) {
  const t = useTranslations("studio.home");
  const router = useRouter();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await storeDesigns.duplicate(id, t("copyName", { name }), crypto.randomUUID());
          toast.success(t("duplicated"));
          await client.invalidateQueries();
          router.refresh();
        } catch (error) {
          toast.error(isApiError(error) ? error.detail : t("duplicateFailed"));
        } finally {
          setBusy(false);
        }
      }}
    >
      {t("duplicate")}
    </Button>
  );
}

/** A recent design's "เปิด" — counted (`studio_draft_open`). */
export function DraftLink({ href, look, children }: { href: string; look?: Look; children: React.ReactNode }) {
  return (
    <Link href={href} className={buttonVariants(look)} onClick={() => trackStudioHub("studio_draft_open", {})}>
      {children}
    </Link>
  );
}
