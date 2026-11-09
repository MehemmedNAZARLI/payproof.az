import { describe, expect, it } from "vitest";

import {
  bakuDay,
  formatDate,
  formatDateTime,
  formatDayHeading,
  formatLongDate,
  formatMoney,
  formatTime,
  greeting,
} from "./format";

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

describe("dates (Baku time)", () => {
  it("formats a timestamp as day.month.year, hour:minute", () => {
    expect(formatDateTime("2026-11-06T11:10:00Z")).toBe("06.11.2026, 15:10");
  });

  it("writes today in words with the weekday", () => {
    expect(formatLongDate(new Date("2026-11-08T06:30:00Z"))).toBe("8 noyabr 2026, bazar");
    expect(formatLongDate(new Date("2026-11-09T20:30:00Z"))).toBe(
      "10 noyabr 2026, çərşənbə axşamı",
    );
  });

  it("greets by the time of day", () => {
    expect(greeting(new Date("2026-11-08T06:30:00Z"))).toBe("Good morning");
    expect(greeting(new Date("2026-11-08T10:00:00Z"))).toBe("Good afternoon");
    expect(greeting(new Date("2026-11-08T16:00:00Z"))).toBe("Good evening");
    expect(greeting(new Date("2026-11-08T22:30:00Z"))).toBe("Good evening");
  });
});

describe("formatDate", () => {
  it("writes a contract date day first, without touching time zones", () => {
    expect(formatDate("2026-11-03")).toBe("03.11.2026");
    expect(() => formatDate("03.11.2026")).toThrow();
  });
});

describe("day headings (Baku time)", () => {
  // 01:00 in Baku on 8 November is still 7 November in UTC.
  const now = new Date("2026-11-07T21:00:00Z");

  it("reads a moment's Baku calendar day", () => {
    expect(bakuDay(now)).toBe("2026-11-08");
    expect(formatTime("2026-11-06T11:53:00Z")).toBe("15:53");
  });

  it("says today and yesterday in words, other days with the weekday", () => {
    expect(formatDayHeading("2026-11-08", now)).toBe("Today");
    expect(formatDayHeading("2026-11-07", now)).toBe("Yesterday");
    expect(formatDayHeading("2026-11-06", now)).toBe("6 noyabr, cümə");
    expect(formatDayHeading("2025-12-31", now)).toBe("31 dekabr 2025, çərşənbə");
  });
});
