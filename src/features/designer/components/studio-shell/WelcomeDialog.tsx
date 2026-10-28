"use client";

import { useTranslations } from "next-intl";

import { Dialog } from "@/ui/components/Dialog";
import { cn } from "@/ui/lib/cn";

export type WelcomeChoice = "easy" | "pro" | "design_service" | "file";

/**
 * The first-open chooser (editor redesign Phase 1 item 5): how to start — "ง่าย", "มืออาชีพ" or getpack's design
 * team (shown only where the product offers hired design; its free revision rounds only when the setting says how
 * many, D-071) — and a link for artwork made elsewhere. Asked once; the mode is changed any time in the top bar.
 */
export function WelcomeDialog({
  open,
  onPick,
  onClose,
  designService,
}: {
  open: boolean;
  onPick: (choice: WelcomeChoice) => void;
  onClose: () => void;
  /** `null` = the product does not offer hired design. */
  designService: { freeRevisions: number | null } | null;
}) {
  const t = useTranslations("designer.shell.welcome");
  const tCommon = useTranslations("common");
  const cards: { id: Exclude<WelcomeChoice, "file">; points: string[]; art: React.ReactNode; tag?: string }[] = [
    { id: "easy", points: [t("easy.p1"), t("easy.p2"), t("easy.p3")], art: <EasyArt />, tag: t("recommended") },
    { id: "pro", points: [t("pro.p1"), t("pro.p2"), t("pro.p3")], art: <ProArt /> },
    ...(designService
      ? [
          {
            id: "design_service" as const,
            points: [
              ...(designService.freeRevisions !== null
                ? [t("design_service.revisions", { count: designService.freeRevisions })]
                : []),
              t("design_service.p2"),
              t("design_service.p3"),
            ],
            art: <TeamArt />,
          },
        ]
      : []),
  ];
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t("title")}
      description={t("body")}
      closeLabel={tCommon("actions.close")}
      size="xl"
    >
      <div className={cn("grid gap-3", cards.length === 3 ? "min-[900px]:grid-cols-3" : "min-[900px]:grid-cols-2")}>
        {cards.map((card, i) => (
          <button
            key={card.id}
            type="button"
            data-welcome={card.id}
            autoFocus={i === 0}
            onClick={() => onPick(card.id)}
            className={cn(
              "border-border bg-surface-subtle hover:border-primary focus-visible:ring-focus-ring relative flex flex-col gap-2 rounded-2xl border-[1.5px] p-4 text-start outline-none focus-visible:ring-2",
              "duration-fast ease-standard transition-colors",
            )}
          >
            {card.tag ? (
              <span className="bg-primary text-primary-fg absolute end-2.5 top-2.5 rounded-md px-2 py-0.5 text-[11px] font-semibold">
                {card.tag}
              </span>
            ) : null}
            <span
              aria-hidden="true"
              className="bg-canvas hidden h-24 place-items-center overflow-hidden rounded-xl min-[900px]:grid"
            >
              {card.art}
            </span>
            <b className="text-base font-semibold">{t(`${card.id}.title`)}</b>
            <span className="text-muted text-sm">{t(`${card.id}.body`)}</span>
            <ul className="text-muted list-disc space-y-0.5 ps-4 text-xs">
              {card.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>
      <div className="text-muted mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p>
          {t("file.question")}{" "}
          <button
            type="button"
            data-welcome="file"
            onClick={() => onPick("file")}
            className="text-primary font-semibold underline underline-offset-4"
          >
            {t("file.link")}
          </button>
        </p>
        <p className="text-xs">{t("switchLater")}</p>
      </div>
    </Dialog>
  );
}

/* Simple shapes in the theme's tokens — no pictures of real work, no sample artwork. */
function EasyArt() {
  return (
    <svg viewBox="0 0 160 80" className="h-[84%] w-[88%]">
      <rect x="44" y="18" width="72" height="44" rx="6" className="fill-sage-subtle stroke-sage" />
      <circle cx="62" cy="40" r="9" className="fill-primary" />
      <rect x="77" y="33" width="28" height="4" rx="2" className="fill-fg" />
      <rect x="77" y="42" width="20" height="4" rx="2" className="fill-fg" opacity=".5" />
      <circle cx="112" cy="58" r="9" className="fill-info" />
      <path
        d="m107.5 58 3 3 5-6"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ProArt() {
  return (
    <svg viewBox="0 0 160 80" className="h-[84%] w-[88%]">
      <rect x="18" y="8" width="128" height="5" className="fill-border" />
      <rect x="18" y="8" width="5" height="66" className="fill-border" />
      <rect x="40" y="22" width="72" height="44" className="fill-sage-subtle stroke-sage" />
      <path d="M64 22v44M88 22v44" className="stroke-fg" strokeDasharray="3 2" strokeWidth="1" opacity=".4" />
      <rect x="46" y="28" width="16" height="10" fill="none" className="stroke-info" strokeWidth="1.5" />
      <circle cx="46" cy="28" r="1.8" className="fill-info" />
      <circle cx="62" cy="38" r="1.8" className="fill-info" />
    </svg>
  );
}
function TeamArt() {
  return (
    <svg viewBox="0 0 160 80" className="h-[84%] w-[88%]">
      <circle cx="66" cy="30" r="8" className="fill-primary" />
      <path d="M52 62a14 14 0 0 1 28 0z" className="fill-primary" />
      <circle cx="88" cy="36" r="7" className="fill-info" />
      <path d="M76 62a12 12 0 0 1 24 0z" className="fill-info" />
      <rect x="92" y="14" width="26" height="12" rx="6" className="fill-surface stroke-border" />
      <circle cx="99" cy="20" r="1.4" className="fill-fg" />
      <circle cx="105" cy="20" r="1.4" className="fill-fg" />
      <circle cx="111" cy="20" r="1.4" className="fill-fg" />
    </svg>
  );
}
