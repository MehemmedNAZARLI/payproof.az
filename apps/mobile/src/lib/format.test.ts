import { describe, expect, it } from "vitest";

import { formatMoney } from "./format";

describe("formatMoney", () => {
  it("groups thousands with dots and uses a decimal comma (az-AZ, as the prototype)", () => {
    expect(formatMoney("12000.00", "AZN")).toBe("12.000,00 AZN");
    expect(formatMoney("1234567.89", "USD")).toBe("1.234.567,89 USD");
  });

  it("uses a real minus sign and can omit the currency", () => {
    expect(formatMoney("-500.00")).toBe("−500,00");
  });

  it("keeps small amounts and zero intact", () => {
    expect(formatMoney("0.05", "AZN")).toBe("0,05 AZN");
    expect(formatMoney("999.00")).toBe("999,00");
  });

  it("never goes through floating point", () => {
    expect(formatMoney("90071992547409.93", "AZN")).toBe("90.071.992.547.409,93 AZN");
  });

  it("rejects strings that are not contract decimals", () => {
    expect(() => formatMoney("12000", "AZN")).toThrow();
    expect(() => formatMoney("1e3", "AZN")).toThrow();
  });
});
