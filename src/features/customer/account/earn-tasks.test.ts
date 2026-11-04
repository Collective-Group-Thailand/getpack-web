import { describe, expect, it } from "vitest";

import { buildLoyaltyTasks, REVIEW_TASK_STATES } from "../../../../mocks/store/loyalty-fixtures";

import { checklistView, newlyDone, taskLink, TASK_ROUTES } from "./earn-tasks";

describe("the earn checklist's view of the API list", () => {
  const data = buildLoyaltyTasks(REVIEW_TASK_STATES);

  it("keeps the API's order and moves only the recommended task out of the list", () => {
    const view = checklistView(data);
    expect(view.recommended?.code).toBe("tax_profile");
    expect(view.rows.map((task) => task.code)).toEqual(
      data.tasks.filter((task) => !task.recommended).map((task) => task.code),
    );
    // todo and held first, done last (the API's sort, not ours).
    const statuses = view.rows.map((task) => task.status);
    expect(statuses.lastIndexOf("todo")).toBeLessThan(statuses.indexOf("done"));
    expect(statuses.indexOf("held")).toBeLessThan(statuses.indexOf("done"));
  });

  it("does not re-sort a list the API sent in another order", () => {
    const reversed = { ...data, tasks: [...data.tasks].reverse() };
    expect(checklistView(reversed).rows.map((task) => task.code)).toEqual(
      reversed.tasks.filter((task) => !task.recommended).map((task) => task.code),
    );
  });

  it("counts done tasks out of all of them", () => {
    const view = checklistView(data);
    expect([view.done, view.total]).toEqual([3, 16]);
    expect(view.allDone).toBe(false);
  });

  it("offers no next step once the 12-month cap is used up", () => {
    const capped = buildLoyaltyTasks(REVIEW_TASK_STATES, { activityEarned12m: 600 });
    const view = checklistView(capped);
    expect(capped.remainingPoints).toBe(0);
    expect(view.capReached).toBe(true);
    expect(view.recommended).toBeNull();
    expect(view.rows).toHaveLength(16);
  });

  it("announces only tasks that turned done, never held ones", () => {
    const after = buildLoyaltyTasks({
      ...REVIEW_TASK_STATES,
      tax_profile: { status: "done", doneAt: "2026-11-04T08:00:00.000Z" },
      google_link: { status: "held" },
    });
    expect(newlyDone(data, after).map((task) => task.code)).toEqual(["tax_profile"]);
    expect(newlyDone(undefined, after)).toEqual([]);
  });
});

describe("task links", () => {
  it("has a route for every code but the LINE OA", () => {
    expect(Object.keys(TASK_ROUTES)).toHaveLength(15);
    expect(taskLink("packaging_profile", null)).toEqual({ href: "/account/packaging-profile", external: false });
  });

  it("adds the LINE OA as a friend when its id is known, else opens the chat help page", () => {
    expect(taskLink("line_oa_friend", "@getpack")).toEqual({
      href: "https://line.me/R/ti/p/%40getpack",
      external: true,
    });
    expect(taskLink("line_oa_friend", null)).toEqual({ href: "/help/chat", external: false });
  });
});
