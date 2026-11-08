import { describe, expect, it } from "vitest";

import { filterCount, filterStatuses, packagesHref, parseFilter } from "./filters";

const counts = {
  PROCESSING: 1,
  NEEDS_REVIEW: 4,
  NEEDS_FIX: 4,
  READY_FOR_APPROVAL: 2,
  APPROVED_READY: 1,
  EXPORTED: 2,
};

describe("package filters", () => {
  it("reads a filter from the URL, defaulting to all", () => {
    expect(parseFilter("problem")).toBe("problem");
    expect(parseFilter(null)).toBe("all");
    expect(parseFilter("PAID")).toBe("all");
    expect(parseFilter("toString")).toBe("all");
  });

  it("maps chips to API statuses", () => {
    expect(filterStatuses("all")).toBeUndefined();
    expect(filterStatuses("problem")).toEqual(["NEEDS_FIX", "NEEDS_REVIEW"]);
  });

  it("counts a chip from the dashboard's status counts", () => {
    expect(filterCount("all", counts)).toBe(14);
    expect(filterCount("problem", counts)).toBe(8);
    expect(filterCount("ready", counts)).toBe(2);
  });

  it("links to the list with the filter and search in the URL", () => {
    expect(packagesHref("all")).toBe("/packages");
    expect(packagesHref("ready")).toBe("/packages?status=ready");
    expect(packagesHref("problem", " 1042 ")).toBe("/packages?status=problem&q=1042");
    expect(packagesHref("all", "Restoran qrupu")).toBe("/packages?q=Restoran+qrupu");
  });
});
