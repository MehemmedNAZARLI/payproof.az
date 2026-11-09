import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("is a non-submitting button by default and fires its action", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Daxil ol</Button>);
    const button = screen.getByRole("button", { name: "Daxil ol" });
    expect(button).toHaveAttribute("type", "button");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not fire while disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick} icon="eye">
        Review evidence and approve
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Review evidence and approve" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
