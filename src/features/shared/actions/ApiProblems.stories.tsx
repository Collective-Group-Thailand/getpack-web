import type { Meta, StoryObj } from "@storybook/react-vite";
import { NextIntlClientProvider } from "next-intl";

import commonEn from "@/i18n/messages/en/common/common.json";
import problemsEn from "@/i18n/messages/en/common/problems.json";
import commonTh from "@/i18n/messages/th/common/common.json";
import problemsTh from "@/i18n/messages/th/common/problems.json";
import { parseMockScenario } from "@/lib/api/mock-scenario";
import { ApiError } from "@/lib/api/problem";

import { OPERATION_PROBLEMS, PROBLEM_EXAMPLES } from "../../../../mocks/generated/problems";
import { QueryError } from "./QueryError";

/*
 * The Storybook half of the `?mock=` switcher (U1 U-F0.1). Storybook has no mock API, so instead
 * of intercepting a request this builds the `ApiError` the scenario would produce — the same
 * operation, code, status and example body as `mocks/scenario.ts` answers with — and renders the
 * shared error surface with it. Type any `operationId:code` into the `scenario` control; the
 * example's `detail` is the contract's Thai one in both locales, where the API would localise it.
 */

const MESSAGES = {
  th: { common: commonTh, problems: problemsTh },
  en: { common: commonEn, problems: problemsEn },
} as const;

function errorFor(scenario: string): ApiError | string {
  const [parsed] = parseMockScenario(scenario);
  if (!parsed) return `"${scenario}" is not operationId:code`;
  const operation = OPERATION_PROBLEMS[parsed.operationId];
  if (!operation) return `No operation ${parsed.operationId} in the contract`;
  const status = operation.problems[parsed.code];
  const example = PROBLEM_EXAMPLES[parsed.code];
  if (status === undefined || !example) {
    return `${parsed.operationId} documents: ${Object.keys(operation.problems).join(", ")}`;
  }
  return new ApiError({ ...example, status, requestId: "storybook-0000" });
}

function ApiProblem({ scenario, locale }: { scenario: string; locale: "th" | "en" }) {
  const error = errorFor(scenario);
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Asia/Bangkok">
      <div className="max-w-xl">
        {typeof error === "string" ? <p className="text-muted text-sm">{error}</p> : <QueryError error={error} />}
      </div>
    </NextIntlClientProvider>
  );
}

const meta = {
  title: "Patterns/API problems",
  component: ApiProblem,
  args: { scenario: "store.cart.get:internal.unexpected", locale: "th" },
  argTypes: {
    scenario: { control: "text", description: "`operationId:code`, as in `?mock=` (U-F0.1)" },
    locale: { control: "inline-radio", options: ["th", "en"] },
  },
} satisfies Meta<typeof ApiProblem>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Any documented problem: change `scenario`. */
export const Scenario: Story = {};

/** An edit that lost a race (`412 concurrency.stale`), in English. */
export const Stale: Story = { args: { scenario: "admin.campaigns.update:concurrency.stale", locale: "en" } };

/** Too many requests, as the per-IP throttles answer. */
export const RateLimited: Story = { args: { scenario: "auth.customer.requestOtp:http.too_many_requests" } };
