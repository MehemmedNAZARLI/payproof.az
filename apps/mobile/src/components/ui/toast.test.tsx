import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "./toast-store";
import { Toaster } from "./toaster";

describe("Toaster", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    act(() => vi.runAllTimers());
    vi.useRealTimers();
  });

  it("announces errors assertively and other messages politely", () => {
    render(<Toaster />);
    act(() => {
      toast.error("Network error", "Closentını yoxlayın.");
      toast.success("Package approved.");
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    expect(screen.getByRole("alert")).toHaveTextContent("Closentını yoxlayın.");
    expect(screen.getByRole("status")).toHaveTextContent("Package approved.");
  });

  it("can be dismissed with its labelled close button", () => {
    render(<Toaster />);
    act(() => void toast.info("Siyahı yeniləndi."));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    act(() => vi.advanceTimersByTime(250));
    expect(screen.queryByText("Siyahı yeniləndi.")).toBeNull();
  });
});
