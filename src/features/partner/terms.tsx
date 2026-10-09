import { Icon } from "@/ui/icons";

/**
 * "What do these words mean?" — the few terms a page leans on, explained in one plain sentence each,
 * folded under one line so it never pushes the work down. Not a hover tooltip: an owner on a phone
 * cannot hover, and a tooltip hides the answer from the one who needs it most.
 */
export function TermsHelp({ title, terms }: { title: string; terms: { term: string; meaning: string }[] }) {
  return (
    <details className="border-border bg-surface group rounded-xl border">
      <summary className="hover:bg-surface-subtle flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-4 font-medium md:min-h-10">
        <Icon name="help" size={18} className="text-primary shrink-0" aria-hidden="true" />
        <span className="flex-1">{title}</span>
        <Icon name="chevron-down" size={18} className="text-muted transition-transform group-open:rotate-180" />
      </summary>
      <dl
        data-terms=""
        className="border-border grid gap-x-6 gap-y-3 border-t px-4 py-3 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]"
      >
        {terms.map(({ term, meaning }) => (
          <div key={term} className="contents">
            <dt className="text-fg font-semibold">{term}</dt>
            <dd className="text-muted -mt-2 md:mt-0">{meaning}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** Builds the list from `partner.terms.<key>` = [term, meaning]. */
export function termsFrom(raw: (key: string) => unknown, keys: string[]) {
  return keys.map((key) => {
    const [term, meaning] = raw(key) as [string, string];
    return { term, meaning };
  });
}
