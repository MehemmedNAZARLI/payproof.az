import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Loading, Skeleton, SkeletonBar, SkeletonTable, SkeletonText } from "./skeleton";

test("the status region contains real text, the shapes are hidden from assistive tech", () => {
  render(<SkeletonText lines={3} />);
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("Yüklənir…"); // live regions read content, not aria-label
  const bars = status.querySelectorAll("[data-skeleton]");
  expect(bars).toHaveLength(3);
  bars.forEach((bar) => expect(bar.closest("[aria-hidden='true']")).not.toBeNull());
});

test("table skeleton: rows × columns", () => {
  render(<SkeletonTable rows={4} columns={5} />);
  expect(screen.getByRole("status").querySelectorAll("[data-skeleton]")).toHaveLength(20);
});

test("a single block takes its size from className and animates only without reduced motion", () => {
  render(<Skeleton className="h-24 w-full" />);
  const bar = screen.getByRole("status").querySelector("[data-skeleton]")!;
  expect(bar).toHaveClass("h-24", "w-full", "motion-safe:animate-pulse");
});

test("a screen with many placeholders announces loading once", () => {
  render(
    <Loading className="grid grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <SkeletonBar key={i} className="h-24" />
      ))}
    </Loading>,
  );
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.getByRole("status").querySelectorAll("[data-skeleton]")).toHaveLength(4);
});
