import { describe, expect, it } from "vitest";
import { cents, decimal, sumLines } from "../src/money";
import { id, slugOf } from "../src/ids";

describe("money in integer cents", () => {
  it("parses contract decimal strings exactly", () => {
    expect(cents("9.10")).toBe(910);
    expect(cents("12000.00")).toBe(1_200_000);
    expect(cents("-500.00")).toBe(-50_000);
  });
  it("formats back to the contract string", () => {
    expect(decimal(1_200_000)).toBe("12000.00");
    expect(decimal(-50_000)).toBe("-500.00");
    expect(decimal(5)).toBe("0.05");
  });
  it("sums qty × unit price without floats", () => {
    expect(
      sumLines([
        { qty: 800, unit_price: "9.00" },
        { qty: 400, unit_price: "12.00" },
      ]),
    ).toBe(1_200_000);
  });
  it.each(["9.1", "1,00", "", "abc"])("rejects %j", (v) => expect(() => cents(v)).toThrow());
  it("refuses unsafe integers", () =>
    expect(() => sumLines([{ qty: 1e9, unit_price: "99999999.99" }])).toThrow());
});

describe("ids", () => {
  it("maps fixture slugs to the readable UUIDs used in contract examples", () => {
    expect(id.user("u1")).toBe("0193a000-0000-7000-8000-000000000001");
    expect(id.customer("c2")).toBe("0193a000-0000-7000-8001-000000000002");
    expect(id.pkg("pkg_1042")).toBe("0193a000-0000-7000-8002-000000001042");
    expect(id.order("PO-381")).toBe("0193a000-0000-7000-8003-000000000381");
    expect(id.task("T-118")).toBe("0193a000-0000-7000-8006-000000000118");
    expect(id.ruleSet("c1", 2)).toBe("0193a000-0000-7000-800d-000000000102");
  });
  it("reverses a UUID to its slug", () => {
    expect(slugOf.user("0193a000-0000-7000-8000-000000000005")).toBe("u5");
    expect(slugOf.pkg("0193a000-0000-7000-8002-000000001042")).toBe("pkg_1042");
    expect(slugOf.user("not-a-uuid")).toBeNull();
  });
});
