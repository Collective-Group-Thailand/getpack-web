import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import marketing from "@/i18n/messages/th/admin/marketing.json";
import common from "@/i18n/messages/th/common/common.json";

import { AGENT_ROWS } from "../../../../mocks/admin/loyalty-p2";

import { AgentLinksTable } from "./AgentLinksTable";

function renderTh(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="th" messages={{ marketing, common } as never} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

describe("AgentLinksTable", () => {
  it("shows each agent's link performance as the API sent it", () => {
    renderTh(<AgentLinksTable rows={AGENT_ROWS.map(({ agentName: _name, ...row }) => row)} />);
    const table = screen.getAllByRole("table", { name: "ลิงก์ของตัวแทน" })[0]!;
    const row = within(table).getByText("AGT0042").closest("tr")!;
    expect(row).toHaveTextContent("38,400.00");
    expect(row).toHaveTextContent("1,920.00");
  });
});
