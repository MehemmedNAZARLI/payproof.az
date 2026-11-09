import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CheckOutcomeBadge, PackageStatusBadge, TaskStatusBadge } from "./badge";
import { Chip } from "./chip";

describe("status badges", () => {
  it("label package statuses in Azerbaijani with the status tone", () => {
    render(<PackageStatusBadge status="READY_FOR_APPROVAL" />);
    const badge = screen.getByText("Awaiting approval");
    expect(badge).toHaveClass("bg-accent-soft");
    expect(badge.querySelector("svg")).not.toBeNull();
  });

  it("never shows UNKNOWN as passed", () => {
    render(<CheckOutcomeBadge outcome="UNKNOWN" />);
    expect(screen.getByText("Unknown")).toHaveClass("bg-warning-soft");
  });

  it("label task statuses", () => {
    render(<TaskStatusBadge status="SUBMITTED_FOR_RECHECK" />);
    expect(screen.getByText("Awaiting recheck")).toBeVisible();
  });
});

describe("Chip", () => {
  it("exposes its toggle state with aria-pressed and shows the count", () => {
    const onClick = vi.fn();
    render(
      <Chip pressed={false} count={4} onClick={onClick}>
        Needs attention
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "Needs attention 4", pressed: false });
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("marks the selected filter as pressed", () => {
    render(<Chip pressed>All</Chip>);
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
  });
});
