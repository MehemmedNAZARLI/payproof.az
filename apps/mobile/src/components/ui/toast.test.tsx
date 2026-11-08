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
      toast.error("Şəbəkə xətası", "Bağlantını yoxlayın.");
      toast.success("Paket təsdiqləndi.");
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Şəbəkə xətası");
    expect(screen.getByRole("alert")).toHaveTextContent("Bağlantını yoxlayın.");
    expect(screen.getByRole("status")).toHaveTextContent("Paket təsdiqləndi.");
  });

  it("can be dismissed with its labelled close button", () => {
    render(<Toaster />);
    act(() => void toast.info("Siyahı yeniləndi."));
    fireEvent.click(screen.getByRole("button", { name: "Bildirişi bağla" }));
    act(() => vi.advanceTimersByTime(250));
    expect(screen.queryByText("Siyahı yeniləndi.")).toBeNull();
  });
});
