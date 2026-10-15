import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { topicHubHref, forUseCaseHref } from "./paths";
import { TOPICS } from "./topics";
import { USE_CASES } from "./use-cases";

/**
 * The library's ways in (D-410): by the product it will hold ("กล่องสบู่") and by a feature
 * ("กล่องมีหน้าต่าง") — links to pages of their own, which a search engine can reach from here.
 */
export async function LibraryLinks({ except }: { except?: { useCase?: string; topic?: string } }) {
  const t = await getTranslations("styles");
  const groups = [
    {
      id: "byUseCase",
      links: USE_CASES.filter((u) => u !== except?.useCase).map((u) => ({
        href: forUseCaseHref(u),
        label: t(`useCasePages.${u}.title`),
      })),
    },
    {
      id: "byTopic",
      links: TOPICS.filter((topic) => topic.id !== except?.topic).map((topic) => ({
        href: topicHubHref(topic.id),
        label: t(`topics.${topic.id}.title`),
      })),
    },
  ];
  return (
    <div className="mt-12 grid gap-8 md:grid-cols-2">
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`library-${group.id}`}>
          <h2 id={`library-${group.id}`} className="mb-3 text-lg font-semibold">
            {t(`list.${group.id}`)}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {group.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="border-border hover:bg-bg-subtle focus-visible:ring-focus-ring rounded-control inline-block border px-3 py-1.5 text-sm outline-none focus-visible:ring-2"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
