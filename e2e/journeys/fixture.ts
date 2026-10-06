import { type BrowserContext, expect, type Page, test as base, type TestInfo } from "@playwright/test";

import { gotoHydrated } from "../helpers/session";
import { budgetMax, EXCEPTIONS, judge, type JourneyBudget, type JourneyId, JOURNEYS, type Judgement } from "./budgets";

/**
 * The step counter (U5.0): a walk of one scorecard task that counts what a person has to see or
 * decide, by the rule in `docs/ux/step-counting.md`, and reports it to `reporter.ts`.
 *
 *   const j = journey("T8");
 *   await j.start(`${HOSTS.customer}/account/orders`);
 *   await j.screen("order", () => link.click(), () => expect(heading).toBeVisible());
 *   await j.decide("quantity", () => field.fill("2000"));
 *   await j.done(() => expect(page).toHaveURL(/checkout/));
 *
 * A walk takes the shortest path that exists today; a moderated round measures what people
 * actually do. The difference between the two is the finding, not an error in either.
 *
 * Going over budget and meeting a new required field are *reported*; `STEP_BUDGETS=enforce`
 * makes both fail the test, and a pending walk too. CI enforces it since U5.8; a journey a decision
 * keeps over budget passes only within its exception's ceiling (`EXCEPTIONS`, scorecard §5).
 * A walk that cannot be completed always fails — that is a broken journey, not a long one.
 */

export type StepKind = "screen" | "decision" | "tap";

export interface StepRecord {
  kind: StepKind;
  name: string;
  /** The pathname after the step. */
  path: string;
}

/**
 * `measured` — walked to the task's end · `partial` — walked as far as the product goes today,
 * with the gaps named · `pending` — cannot be walked yet; the deliverable that builds it is named.
 */
export type JourneyState = "measured" | "partial" | "pending";

export interface JourneyRecord {
  id: JourneyId;
  journey: string;
  budget: JourneyBudget["budget"];
  state: JourneyState;
  /** Steps (or taps) counted; `null` when pending. */
  steps: number | null;
  /** For tasks judged by something other than a count (T3's unexplained warnings). */
  metric: number | null;
  overBudget: boolean;
  completed: boolean;
  detail: StepRecord[];
  gaps: string[];
  requiredFields: string[];
  newRequiredFields: string[];
  events: string[];
  missingEvents: string[];
  pending: { reason: string; deliverable: string } | null;
}

export const JOURNEY_ANNOTATION = "journey";
const ENFORCE = process.env.STEP_BUDGETS === "enforce";

/**
 * Records the app's funnel steps, from inside the page.
 *
 * `track()` raises `packio:funnel-step` with the app's own step name (`src/lib/analytics/track.ts`)
 * before mapping it onto packio-api's five ingest names, so the journeys count what the app did —
 * including steps the API derives on its side instead of receiving (`docs/ux/funnels.md`).
 */
async function captureEvents(context: BrowserContext, into: string[]): Promise<void> {
  await context.exposeBinding("__journeyEvent", (_source, name: string) => {
    into.push(name);
  });
  await context.addInitScript(() => {
    const report = (window as unknown as { __journeyEvent: (name: string) => void }).__journeyEvent;
    window.addEventListener("packio:funnel-step", (event) => {
      const name = (event as CustomEvent<string>).detail;
      if (typeof name === "string") report(name);
    });
  });
}

/** The pathname only: `/configure/x?size=…` is the same screen whatever its query says. */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export class Journey {
  readonly def: JourneyBudget;
  private readonly detail: StepRecord[] = [];
  private readonly gaps: string[] = [];
  private readonly required = new Set<string>();
  private expectedEvents: string[] = [];
  private path: string | null = null;
  private metric: number | null = null;
  private pendingInfo: JourneyRecord["pending"] = null;
  private completed = false;
  constructor(
    readonly page: Page,
    id: JourneyId,
    /** Funnel event names the page sent, in order — filled by `captureEvents`. */
    private readonly events: string[],
  ) {
    this.def = JOURNEYS[id];
  }

  /** Where the task card says the person starts. Not counted (step-counting rule 1). */
  async start(url: string): Promise<void> {
    await gotoHydrated(this.page, url);
    this.path = pathOf(this.page.url());
    await this.scanRequired();
  }

  /** Continues from wherever the page already is (after a sign-in helper, say). Not counted. */
  async startHere(): Promise<void> {
    await this.page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
    this.path = pathOf(this.page.url());
    await this.scanRequired();
  }

  /** The view is replaced — a route, or a dialog, sheet or wizard step that takes over. */
  async screen(name: string, action: () => Promise<unknown>, arrived: () => Promise<unknown>): Promise<void> {
    this.guard(name);
    await action();
    await arrived();
    this.record("screen", name);
    await this.scanRequired();
  }

  /** One question the task needs answered (L × W × H is one). Must not change the route. */
  async decide(name: string, action: () => Promise<unknown>): Promise<void> {
    this.guard(name);
    await action();
    const now = pathOf(this.page.url());
    if (now !== this.path) {
      throw new Error(`Decision "${name}" moved the page to ${now} — declare it with j.screen().`);
    }
    this.record("decision", name);
    await this.scanRequired();
  }

  /** T11: every tap counts, navigation included. */
  async tap(name: string, action: () => Promise<unknown>, arrived?: () => Promise<unknown>): Promise<void> {
    this.guard(name);
    await action();
    if (arrived) await arrived();
    this.record("tap", name);
    await this.scanRequired();
  }

  /** Something the task needs that the product does not have yet; makes the journey `partial`. */
  gap(description: string): void {
    this.gaps.push(description);
  }

  /** The value for a task not judged by a count (T3: unexplained warnings). */
  measure(value: number): void {
    this.metric = value;
  }

  /** Funnel events the walk should send, in order (`docs/ux/funnels.md`). Checked in `done`. */
  expectEvents(...names: string[]): void {
    this.expectedEvents = names;
  }

  /**
   * The journey cannot be walked yet. Records why and who builds it, then skips the test as
   * `fixme` so the run stays green and the report still lists it — unless enforced (U5.8): a gate
   * cannot pass a journey nobody walked.
   */
  pending(reason: string, deliverable: string): never {
    this.pendingInfo = { reason, deliverable };
    if (ENFORCE) throw new Error(`${this.def.id} cannot be walked: ${reason} (${deliverable})`);
    base.fixme(true, `pending: ${reason} (${deliverable})`);
    throw new Error("unreachable");
  }

  /** The task's end state is reached: assert it, then judge the count. */
  async done(reached: () => Promise<unknown>): Promise<void> {
    this.guard("done");
    await reached();
    this.completed = true;

    const max = budgetMax(this.def.budget);
    const counted = this.def.budget.unit === "unexplained-warnings" ? this.metric : this.detail.length;
    if (ENFORCE && max !== null && counted !== null) {
      const exception = EXCEPTIONS[this.def.id];
      const messages: Record<Judgement, string | null> = {
        within: null,
        excepted: null,
        over: `${this.def.id} is over its budget of ${max}`,
        "above-ceiling": `${this.def.id} is above its exception's ceiling of ${exception?.ceiling} (budget ${max})`,
        "stale-exception": `${this.def.id} is within its budget of ${max}: remove its exception (scorecard §5, budgets.ts)`,
      };
      expect.soft(messages[judge(this.def.id, counted)] ?? "", `${this.def.id} step budget`).toBe("");
      expect
        .soft(this.newRequiredFields(), `${this.def.id} meets required fields the scorecard does not list`)
        .toEqual([]);
    }
    if (this.expectedEvents.length > 0) {
      // A beacon is sent as the page moves on; give the last one a moment to be seen.
      await expect
        .poll(() => this.missingEvents(), { timeout: 5_000, message: `${this.def.id} funnel events` })
        .toEqual([]);
    }
  }

  private record(kind: StepKind, name: string): void {
    this.path = pathOf(this.page.url());
    this.detail.push({ kind, name, path: this.path });
  }

  toRecord(): JourneyRecord {
    const max = budgetMax(this.def.budget);
    const pending = this.pendingInfo !== null;
    const steps = pending ? null : this.detail.length;
    const judged = this.def.budget.unit === "unexplained-warnings" ? this.metric : steps;
    return {
      id: this.def.id,
      journey: this.def.journey,
      budget: this.def.budget,
      state: pending ? "pending" : this.gaps.length > 0 ? "partial" : "measured",
      steps,
      metric: this.metric,
      overBudget: max !== null && judged !== null && judged > max,
      completed: this.completed,
      detail: this.detail,
      gaps: this.gaps,
      requiredFields: [...this.required].sort(),
      newRequiredFields: this.newRequiredFields(),
      events: this.events,
      missingEvents: this.missingEvents(),
      pending: this.pendingInfo,
    };
  }

  /** Nothing may change the route between two declared steps (step-counting guard 1). */
  private guard(next: string): void {
    if (this.path === null) throw new Error(`${this.def.id}: call j.start() before "${next}".`);
    const now = pathOf(this.page.url());
    if (now !== this.path) {
      throw new Error(
        `${this.def.id}: the page moved from ${this.path} to ${now} before "${next}" without a declared step — ` +
          "a redirect or a screen nobody counted.",
      );
    }
  }

  private newRequiredFields(): string[] {
    return [...this.required].filter((field) => !this.def.requiredFields.includes(field)).sort();
  }

  private missingEvents(): string[] {
    // In order, allowing other events in between: `a, x, b` satisfies `a, b`.
    let at = 0;
    const missing: string[] = [];
    for (const name of this.expectedEvents) {
      const found = this.events.indexOf(name, at);
      if (found === -1) missing.push(name);
      else at = found + 1;
    }
    return missing;
  }

  /** Every visible required field, by accessible name (step-counting guard 2). */
  private async scanRequired(): Promise<void> {
    const names = await this.page
      .evaluate(() => {
        const text = (value: string | null | undefined) =>
          (value ?? "")
            .replace(/\s+/g, " ")
            .replace(/\s*(?:[*＊]\s*)?(?:\(?(?:จำเป็น|required)\)?)?\s*$/i, "")
            .trim();
        const nameOf = (el: Element): string => {
          const labelledBy = el.getAttribute("aria-labelledby");
          if (labelledBy) {
            return text(
              labelledBy
                .split(/\s+/)
                .map((id) => document.getElementById(id)?.textContent)
                .join(" "),
            );
          }
          const aria = el.getAttribute("aria-label");
          if (aria) return text(aria);
          const labels = (el as HTMLInputElement).labels;
          if (labels && labels.length > 0) return text(labels[0]!.textContent);
          // A file picker is usually unlabelled inside a labelled group: name it after the group.
          const group = el.closest("fieldset, [role=group]");
          const legend = group?.querySelector("legend")?.textContent ?? group?.getAttribute("aria-label");
          if (legend) return text(legend);
          const fallback = el.getAttribute("name") ?? el.getAttribute("placeholder") ?? el.closest("[id]")?.id;
          return text(fallback ?? el.tagName.toLowerCase());
        };
        const visible = (el: Element) =>
          typeof (el as HTMLElement).checkVisibility === "function"
            ? (el as HTMLElement).checkVisibility()
            : (el as HTMLElement).offsetParent !== null;
        return (
          [...document.querySelectorAll("input, select, textarea, [role=radiogroup], [role=combobox]")]
            .filter((el) => (el as HTMLInputElement).required || el.getAttribute("aria-required") === "true")
            // Radix mirrors a radio group or select into an aria-hidden native input; the group is the field.
            .filter(
              (el) => (el as HTMLInputElement).type !== "hidden" && !el.closest("[aria-hidden=true]") && visible(el),
            )
            .map(nameOf)
            .filter(Boolean)
        );
      })
      .catch(() => [] as string[]);
    for (const name of names) this.required.add(name);
  }
}

/** Attaches the walk's record to the test, for `reporter.ts`, whatever the outcome. */
function annotate(info: TestInfo, journey: Journey): void {
  info.annotations.push({ type: JOURNEY_ANNOTATION, description: JSON.stringify(journey.toRecord()) });
}

export const test = base.extend<{ journey: (id: JourneyId) => Journey }>({
  // Playwright calls the second argument `use`; named `provide` so the React hooks rule leaves it be.
  journey: async ({ page }, provide, info) => {
    const events: string[] = [];
    await captureEvents(page.context(), events);
    let current: Journey | null = null;
    await provide((id) => {
      if (current) throw new Error("One journey per test.");
      current = new Journey(page, id, events);
      return current;
    });
    if (current) annotate(info, current);
  },
});

export { expect } from "@playwright/test";
