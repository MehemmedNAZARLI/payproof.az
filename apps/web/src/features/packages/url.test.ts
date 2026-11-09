import { describe, expect, test } from "vitest";
import { listParams, listSearch, sortFromParam, sortParam } from "./url";

const sp = (s: string) => new URLSearchParams(s);
const UUID = "0193a000-0000-7000-8001-000000000002";

describe("listParams (URL → API query)", () => {
  test("reads every filter the API knows", () => {
    expect(
      listParams(
        sp(
          `q=INV-10&status=NEEDS_FIX,NEEDS_REVIEW&customer_id=${UUID}&issue=R-002&owner_id=${UUID}&from=2026-10-01&to=2026-10-31&sort=-total&cursor=MjA`,
        ),
      ),
    ).toEqual({
      q: "INV-10",
      status: ["NEEDS_FIX", "NEEDS_REVIEW"],
      customer_id: UUID,
      issue: "R-002",
      owner_id: UUID,
      from: "2026-10-01",
      to: "2026-10-31",
      sort: "-total",
      cursor: "MjA",
    });
  });

  test("drops values the API would reject (shared or hand-edited links)", () => {
    expect(
      listParams(
        sp(
          "status=PAID,NEEDS_FIX&issue=R-999&sort=-price&from=31.10.2026&customer_id=abc&q=%20%20",
        ),
      ),
    ).toEqual({
      status: ["NEEDS_FIX"],
    });
  });

  test("de-duplicates statuses, drops impossible dates and an inverted range (all would 422)", () => {
    expect(listParams(sp("status=NEEDS_FIX,NEEDS_FIX&from=2026-13-45&to=2026-02-30"))).toEqual({
      status: ["NEEDS_FIX"],
    });
    expect(listParams(sp("from=2026-10-31&to=2026-10-01"))).toEqual({ from: "2026-10-31" });
  });

  test("an empty URL means the default list", () => {
    expect(listParams(sp(""))).toEqual({});
  });
});

describe("listSearch (state → URL)", () => {
  test("keeps a canonical order and leaves out empty values", () => {
    expect(
      listSearch({ sort: "-total", status: ["NEEDS_FIX"], q: "INV", owner_id: undefined }),
    ).toBe("?q=INV&status=NEEDS_FIX&sort=-total");
    expect(listSearch({})).toBe("");
  });

  test("the default sort is not written to the URL", () => {
    expect(listSearch({ sort: "-updated_at" })).toBe("");
  });

  test("round-trips", () => {
    const url = `?q=INV&status=NEEDS_FIX,NEEDS_REVIEW&customer_id=${UUID}&from=2026-10-01&sort=total&cursor=MjA`;
    expect(listSearch(listParams(sp(url)))).toBe(url);
  });
});

test("sort ↔ table state", () => {
  expect(sortFromParam("-problem_age")).toEqual({ id: "problem_age", desc: true });
  expect(sortFromParam(undefined)).toEqual({ id: "updated_at", desc: true });
  expect(sortParam({ id: "customer", desc: false })).toBe("customer");
  expect(sortParam({ id: "total", desc: true })).toBe("-total");
});
