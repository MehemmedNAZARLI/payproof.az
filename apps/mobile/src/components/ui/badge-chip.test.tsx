import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CheckOutcomeBadge, PackageStatusBadge, TaskStatusBadge } from "./badge";
import { Chip } from "./chip";

describe("status badges", () => {
  it("label package statuses in Azerbaijani with the status tone", () => {
    render(<PackageStatusBadge status="READY_FOR_APPROVAL" />);
    const badge = screen.getByText("Təsdiq gözləyir");
    expect(badge).toHaveClass("bg-brand-50");
    expect(badge.querySelector("svg")).not.toBeNull();
  });

  it("never shows UNKNOWN as passed", () => {
    render(<CheckOutcomeBadge outcome="UNKNOWN" />);
    expect(screen.getByText("Naməlum")).toHaveClass("bg-warning-bg");
  });

  it("label task statuses", () => {
    render(<TaskStatusBadge status="SUBMITTED_FOR_RECHECK" />);
    expect(screen.getByText("Yenidən yoxlamada")).toBeVisible();
  });
});

describe("Chip", () => {
  it("exposes its toggle state with aria-pressed and shows the count", () => {
    const onClick = vi.fn();
    render(
      <Chip pressed={false} count={4} onClick={onClick}>
        Problemli
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "Problemli 4", pressed: false });
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("marks the selected filter as pressed", () => {
    render(<Chip pressed>Hamısı</Chip>);
    expect(screen.getByRole("button", { name: "Hamısı" })).toHaveAttribute("aria-pressed", "true");
  });
});
