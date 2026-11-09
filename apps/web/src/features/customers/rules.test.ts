import { expect, test } from "vitest";
import { parseTolerance, sameRules } from "./rules";

test("tolerance: comma or dot, 0.00–1.00, two decimals as a string (never a float)", () => {
  expect(parseTolerance("0,05")).toBe("0.05");
  expect(parseTolerance("0.5")).toBe("0.50");
  expect(parseTolerance("1")).toBe("1.00");
  expect(parseTolerance(" 0 ")).toBe("0.00");
  expect(parseTolerance("1,01")).toBeNull(); // a wide tolerance would hide real differences
  expect(parseTolerance("0.005")).toBeNull();
  expect(parseTolerance("-0.1")).toBeNull();
  expect(parseTolerance("abc")).toBeNull();
});

test("nothing changed → no new version", () => {
  const cur = {
    require_po: true,
    require_delivery: true,
    require_signature: false,
    tolerance: "0.01",
  };
  expect(sameRules(cur, { ...cur })).toBe(true);
  expect(sameRules(cur, { ...cur, require_signature: true })).toBe(false);
  expect(sameRules(cur, { ...cur, tolerance: "0.02" })).toBe(false);
});
