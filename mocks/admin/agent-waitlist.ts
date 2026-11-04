/**
 * The agents' waiting list in the back office (P7 pilot switch, API-CHANGES-P7 §2): `admin.agentWaitlist.list` and
 * `.export`, reading the rows the public form wrote (`../store/agent.ts`). Sales Manager, C-Level and Superadmin
 * (`agent_waitlist.read`); everyone else gets 403, as from the API. The export answers with a fake signed link.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can } from "../personas";
import { agentWaitlist } from "../store/agent";
import { matchesQuery, paginate, problem } from "../support";

const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const reader = (request: Request) => {
  const who = staffPersonaOf(request);
  return who && can(who, "agent_waitlist.read") ? who : null;
};

export const agentWaitlistHandlers = [
  http.get("*/v1/admin/agent-waitlist", ({ request }) => {
    if (!reader(request)) return forbidden();
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const rows = agentWaitlist().filter((row) => matchesQuery(q, row.name, row.email, row.phone));
    return HttpResponse.json(
      paginate(rows, {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),
  http.post("*/v1/admin/agent-waitlist/actions/export", ({ request }) => {
    if (!reader(request)) return forbidden();
    const expiresAt = new Date(Date.now() + 5 * 60_000 + 7 * 3_600_000).toISOString().slice(0, 19) + "+07:00";
    // A data link stands in for the API's signed file link: the same columns, local phones, UTF-8 with a BOM.
    const lines = [
      "name,phone,email,sales_channel,join_count,created_at,last_joined_at",
      ...agentWaitlist().map((row) =>
        [
          row.name,
          row.phone ? `0${row.phone.slice(3)}` : "",
          row.email ?? "",
          row.salesChannel ?? "",
          row.joinCount,
          row.createdAt,
          row.lastJoinedAt,
        ]
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ];
    return HttpResponse.json({
      url: `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${lines.join("\n")}`)}`,
      expiresAt,
      rows: agentWaitlist().length,
    } satisfies Schemas["AgentWaitlistExportDto"]);
  }),
];
