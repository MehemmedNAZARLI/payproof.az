import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { DateTime, Money } from "./format";

test("Money formats the decimal string without floats, currency kept apart", () => {
  render(
    <>
      <Money amount="12000.00" currency="AZN" />
      <Money amount="-500.00" currency="USD" />
      <Money amount="1234567.05" currency="AZN" />
    </>,
  );
  expect(screen.getByText("12.000,00 AZN")).toHaveClass("tabular-nums", "whitespace-nowrap");
  expect(screen.getByText("−500,00 USD")).toBeInTheDocument();
  expect(screen.getByText("1.234.567,05 AZN")).toBeInTheDocument();
});

test("DateTime renders a <time> with the ISO value, in Baku time", () => {
  render(
    <>
      <DateTime value="2026-11-03T05:12:00Z" />
      <DateTime value="2026-11-03" format="date" />
      <DateTime value="2026-11-08" format="long" />
    </>,
  );
  expect(screen.getByText("03.11.2026, 09:12")).toHaveAttribute("datetime", "2026-11-03T05:12:00Z");
  expect(screen.getByText("03.11.2026").tagName).toBe("TIME");
  expect(screen.getByText("8 noyabr 2026")).toHaveAttribute("datetime", "2026-11-08");
});
