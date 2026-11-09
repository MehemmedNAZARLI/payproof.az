import { expect, test } from "vitest";
import { addDays, bakuToday, defaultAssignee, dueState, stepTemplate } from "./helpers";

test("today is the Baku calendar day (UTC+4), not the browser's", () => {
  expect(bakuToday(new Date("2026-11-08T19:59:00Z"))).toBe("2026-11-08");
  expect(bakuToday(new Date("2026-11-08T20:00:00Z"))).toBe("2026-11-09");
});

test("addDays crosses month and year ends", () => {
  expect(addDays("2026-11-30", 2)).toBe("2026-12-02");
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
});

test("due state: overdue before today, today on the day; resolved tasks are never late", () => {
  const now = new Date("2026-11-08T08:00:00Z");
  expect(dueState("2026-11-07", "OPEN", now)).toBe("overdue");
  expect(dueState("2026-11-08", "IN_PROGRESS", now)).toBe("today");
  expect(dueState("2026-11-09", "OPEN", now)).toBeNull();
  expect(dueState("2026-11-01", "RESOLVED", now)).toBeNull();
});

test("step templates name the order when it is known", () => {
  expect(stepTemplate("R-001", "PO-381")).toContain("(PO-381)");
  expect(stepTemplate("R-001", null)).toContain("(PO)");
  expect(stepTemplate("R-006", null)).toMatch(/anbar/);
});

test("default assignee follows the rule's department, among assignable users", () => {
  const users = [
    { id: "a", title: "Maliyyə əməkdaşı" },
    { id: "l", title: "Mühasib" },
    { id: "n", title: "Satış meneceri" },
    { id: "e", title: "Anbar və logistika" },
  ];
  expect(defaultAssignee("R-001", users)).toBe("l");
  expect(defaultAssignee("R-005", users)).toBe("n");
  expect(defaultAssignee("R-007", users)).toBe("e");
  expect(defaultAssignee("R-007", users.slice(0, 1))).toBe(""); // nobody fits: the user picks
});
