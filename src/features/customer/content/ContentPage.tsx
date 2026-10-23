import { JsonLd } from "@/features/customer/seo/JsonLd";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import type { Crumb } from "@/lib/seo";

/**
 * The frame every written page shares (how it works, about, partner, legal): breadcrumbs, one h1,
 * an answer-first paragraph, then the body. The answer paragraph is `#page-answer`, the selector
 * the page's `speakable` structured data names: the two or three sentences that answer the
 * page's question before anything else, for a reader, a voice assistant or an answer engine alike.
 */
export function ContentPage({
  crumbs,
  crumbLabel,
  title,
  answer,
  lead,
  jsonLd,
  children,
  aside,
}: {
  crumbs: readonly Crumb[];
  crumbLabel: string;
  title: string;
  /** The answer-first paragraph. */
  answer?: string;
  lead?: string;
  jsonLd?: readonly unknown[];
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-12">
      {jsonLd?.map((data, index) => (
        <JsonLd key={index} data={data} />
      ))}
      <Breadcrumbs label={crumbLabel} items={crumbs.map((crumb) => ({ label: crumb.name, href: crumb.url }))} />
      <header className="mt-6 max-w-3xl">
        <h1 className="text-3xl leading-tight md:text-4xl">{title}</h1>
        {answer ? (
          <p id="page-answer" className="mt-4 text-lg leading-relaxed">
            {answer}
          </p>
        ) : null}
        {lead ? <p className="text-muted mt-3 leading-relaxed">{lead}</p> : null}
      </header>
      <div className={aside ? "mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]" : "mt-10"}>
        <div className="flex min-w-0 flex-col gap-10">{children}</div>
        {aside ? <aside className="lg:sticky lg:top-24">{aside}</aside> : null}
      </div>
    </div>
  );
}

/** A titled block of prose. */
export function ContentSection({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="scroll-mt-24">
      <h2 id={id ? `${id}-title` : undefined} className="text-xl font-semibold md:text-2xl">
        {title}
      </h2>
      <div className="mt-3 max-w-3xl text-[15px] leading-relaxed whitespace-pre-line">{children}</div>
    </section>
  );
}

/** Numbered steps, each a card: the number large, the title, the body, an optional tip. */
export function StepList({
  steps,
  tipLabel,
}: {
  steps: readonly { title: string; body: string; tip?: string }[];
  tipLabel: string;
}) {
  return (
    <ol className="grid gap-4 md:grid-cols-2">
      {steps.map((step, index) => (
        <li key={step.title} className="border-border bg-surface rounded-card flex gap-4 border p-5">
          <span
            aria-hidden="true"
            className="bg-primary text-primary-fg grid size-9 shrink-0 place-items-center rounded-full text-base font-bold"
          >
            {index + 1}
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold">{step.title}</h3>
            <p className="text-muted mt-1.5 text-sm leading-relaxed">{step.body}</p>
            {step.tip ? (
              <p className="bg-bg-subtle mt-3 rounded-lg px-3 py-2 text-sm">
                <span className="font-semibold">{tipLabel} </span>
                {step.tip}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A compact table of contents for the long legal pages. */
export function OnThisPage({ title, items }: { title: string; items: readonly { id: string; title: string }[] }) {
  return (
    <nav aria-label={title} className="border-border bg-surface rounded-card border p-4">
      <p className="text-muted text-xs font-semibold">{title}</p>
      <ol className="mt-2 flex flex-col gap-1.5 text-sm">
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} className="text-fg hover:text-primary underline-offset-4 hover:underline">
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
