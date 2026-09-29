import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";

import { type Budget, budgetMax, type JourneyId, JOURNEYS } from "./budgets";
import { JOURNEY_ANNOTATION, type JourneyRecord } from "./fixture";

/**
 * Collects every walk's record (`fixture.ts`) into `step-counts.json` and `step-counts.md`, and
 * into the GitHub job summary when there is one. The markdown is the U5.0 output — the list of
 * journeys over budget that U5.1 takes as input — and what `docs/ux/step-baseline-*.md` is
 * copied from.
 */

interface Row {
  record: JourneyRecord | null;
  status: TestResult["status"];
  error: string | null;
}

const OUT = process.env.JOURNEY_REPORT_DIR ?? "test-results/journeys";

function budgetText(budget: Budget): string {
  switch (budget.unit) {
    case "steps":
      return `≤ ${budget.max} steps`;
    case "taps":
      return `≤ ${budget.max} taps`;
    case "unexplained-warnings":
      return "0 unexplained warnings";
    case "lever-found":
      return "lever found unaided";
  }
}

function counted(record: JourneyRecord): number | null {
  return record.budget.unit === "unexplained-warnings" ? record.metric : record.steps;
}

function verdict(row: Row): string {
  const { record } = row;
  if (!record) return "not run";
  if (record.state === "pending") return "pending";
  if (!record.completed) return "**walk failed**";
  if (record.overBudget) return "**over budget**";
  return budgetMax(record.budget) === null ? "counted" : "within budget";
}

export default class JourneyReporter implements Reporter {
  private readonly rows = new Map<JourneyId, Row>();

  onTestEnd(test: TestCase, result: TestResult): void {
    const annotation = [...result.annotations, ...test.annotations].find((a) => a.type === JOURNEY_ANNOTATION);
    if (!annotation?.description) return;
    const record = JSON.parse(annotation.description) as JourneyRecord;
    // Retries overwrite: the last attempt is the one that counts.
    this.rows.set(record.id, {
      record,
      status: result.status,
      error: result.error?.message?.replace(/\u001b\[[0-9;]*m/g, "").split("\n")[0] ?? null,
    });
  }

  onEnd(): void {
    // Reporters are global in Playwright: in a run with no journeys (`pnpm e2e`) there is nothing to say.
    if (this.rows.size === 0) return;
    const ids = Object.keys(JOURNEYS) as JourneyId[];
    const rows = ids.map((id) => ({ id, row: this.rows.get(id) ?? { record: null, status: "skipped", error: null } }));

    const lines: string[] = [
      "| Task | Journey | State | Count | Budget | Δ | Verdict |",
      "|---|---|---|---|---|---|---|",
    ];
    for (const { id, row } of rows) {
      const def = JOURNEYS[id];
      const record = row.record;
      const count = record ? counted(record) : null;
      const max = budgetMax(def.budget);
      const delta = count !== null && max !== null ? count - max : null;
      lines.push(
        `| ${id} | ${def.journey} | ${record?.state ?? "—"} | ${count ?? "—"} | ${budgetText(def.budget)} | ${
          delta === null ? "—" : delta > 0 ? `+${delta}` : String(delta)
        } | ${verdict(row)} |`,
      );
    }

    const over = rows.filter(({ row }) => row.record?.overBudget);
    const section = (title: string, items: string[]) =>
      items.length > 0 ? ["", `### ${title}`, "", ...items.map((item) => `- ${item}`)] : [];

    lines.push(
      ...section(
        "Over budget (input for U5.1)",
        over.map(({ id, row }) => {
          const steps = row.record!.detail.map((step) => `${step.kind[0]}:${step.name}`).join(" → ");
          return `**${id}** ${JOURNEYS[id].journey}: ${counted(row.record!)} vs ${budgetText(JOURNEYS[id].budget)} — ${steps}`;
        }),
      ),
      ...section(
        "Known gaps (partial journeys)",
        rows.flatMap(({ id, row }) => (row.record?.gaps ?? []).map((gap) => `**${id}** ${gap}`)),
      ),
      ...section(
        "Pending",
        rows.flatMap(({ id, row }) =>
          row.record?.pending ? [`**${id}** ${row.record.pending.reason} — ${row.record.pending.deliverable}`] : [],
        ),
      ),
      ...section(
        "Required fields not in the scorecard",
        rows.flatMap(({ id, row }) =>
          row.record?.newRequiredFields.length ? [`**${id}** ${row.record.newRequiredFields.join(", ")}`] : [],
        ),
      ),
      ...section(
        "Funnel events not seen",
        rows.flatMap(({ id, row }) =>
          row.record?.missingEvents.length ? [`**${id}** ${row.record.missingEvents.join(", ")}`] : [],
        ),
      ),
      ...section(
        "Walks that failed",
        rows.flatMap(({ id, row }) =>
          row.record && !row.record.completed && row.record.state !== "pending"
            ? [`**${id}** ${row.error ?? row.status}`]
            : [],
        ),
      ),
    );

    const markdown = `## Step counters\n\n${lines.join("\n")}\n`;
    mkdirSync(OUT, { recursive: true });
    writeFileSync(
      join(OUT, "step-counts.json"),
      `${JSON.stringify(
        rows.map(({ row }) => row.record),
        null,
        2,
      )}\n`,
    );
    writeFileSync(join(OUT, "step-counts.md"), markdown);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
    console.log(`\n${markdown}\nWritten to ${OUT}/step-counts.{json,md}`);
  }

  /** The run's own reporter (list, github) keeps the console; this one only adds the summary. */
  printsToStdio(): boolean {
    return false;
  }
}
