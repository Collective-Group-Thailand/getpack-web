"use client";

import { useTranslations } from "next-intl";

import { studioHref } from "@/features/customer/studio/paths";
import { Link } from "@/i18n/navigation";
import { trackPdp, type PdpEvents } from "@/lib/analytics/pdp";
import { Button } from "@/ui/components/Button";
import { Icon, type IconName } from "@/ui/icons";

import { configureLinkOf } from "./model";
import { usePdp } from "./PdpProvider";

type Path = PdpEvents["pdp_design_path"]["path"];

const ICONS: Record<Path, IconName> = { own_file: "upload", studio: "pen-tool", hired_design: "palette" };

/**
 * "งานออกแบบลายกล่อง" (pdp redesign item 8): the artwork routes this product offers
 * (`configurator.design.options`) — own file (the configurator with `?design=own_file`, upload after
 * ordering, GLOBAL-RULES §6), the Studio (only where the product has an online designer) and the design
 * team (the configurator's design service). Each card carries the buy box's selection with it.
 */
export function PdpDesignPaths() {
  const t = useTranslations("catalog.pdp.design");
  const { configurator, selection } = usePdp();
  const offered = configurator.design.options;
  const paths: { path: Path; href: string }[] = [
    ...(offered.includes("own_file")
      ? [{ path: "own_file" as const, href: configureLinkOf(configurator, selection, { design: "own_file" }) }]
      : []),
    ...(offered.includes("online_designer")
      ? [{ path: "studio" as const, href: studioHref({ product: configurator.slug, step: "start" }) }]
      : []),
    ...(offered.includes("hired_design")
      ? [{ path: "hired_design" as const, href: configureLinkOf(configurator, selection, { design: "hired_design" }) }]
      : []),
  ];
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 min-[1040px]:grid-cols-3">
      {paths.map(({ path, href }) => (
        <li key={path} className="border-border bg-surface rounded-card flex flex-col gap-2 border p-5">
          <span
            aria-hidden="true"
            className="bg-primary-subtle text-primary-subtle-fg grid size-10 place-items-center rounded-xl"
          >
            <Icon name={ICONS[path]} size={22} />
          </span>
          <h3 className="m-0 text-base font-semibold">{t(`${path}.title`)}</h3>
          <p className="text-muted m-0 text-[0.84375rem]">{t(`${path}.body`)}</p>
          <Button asChild variant="secondary" size="sm" className="mt-auto self-start">
            <Link href={href} onClick={() => trackPdp("pdp_design_path", { product: configurator.slug, path })}>
              {t(`${path}.cta`)}
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}
