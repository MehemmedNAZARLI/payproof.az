import { describe, expect, it } from "vitest";

import { groupByDay } from "./group";

const n = (id: string, created_at: string) => ({
  id,
  text: id,
  package: null,
  created_at,
  read_at: null,
});

describe("groupByDay", () => {
  it("splits at Baku midnight and names the days", () => {
    const now = new Date("2026-11-08T06:30:00Z");
    const groups = groupByDay(
      [
        n("a", "2026-11-08T05:00:00Z"),
        n("b", "2026-11-07T20:30:00Z"), // 00:30 on the 8th in Baku
        n("c", "2026-11-07T19:30:00Z"), // 23:30 on the 7th
        n("d", "2026-11-03T05:15:00Z"),
      ],
      now,
    );
    expect(groups.map((g) => [g.heading, g.items.map((i) => i.id)])).toEqual([
      ["Bu gün", ["a", "b"]],
      ["Dünən", ["c"]],
      ["3 noyabr, çərşənbə axşamı", ["d"]],
    ]);
  });
});
