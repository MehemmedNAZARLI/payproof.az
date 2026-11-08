import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppHeader } from "./app-header";
import { collapseProgress } from "./use-scroll-collapse";

describe("collapseProgress", () => {
  it("runs from 0 at the top to 1 once the large title has scrolled away", () => {
    expect(collapseProgress(0, 48)).toBe(0);
    expect(collapseProgress(24, 48)).toBe(0.5);
    expect(collapseProgress(200, 48)).toBe(1);
  });

  it("clamps rubber-band overscroll above the top", () => {
    expect(collapseProgress(-30, 48)).toBe(0);
  });

  it("uses a short range when there is no large title", () => {
    expect(collapseProgress(4, 0)).toBe(0.5);
  });
});

describe("AppHeader", () => {
  it("exposes the large title as the only page heading", () => {
    render(<AppHeader large title="Paketlər" subtitle="14 paket" />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Paketlər" })).toBeVisible();
    expect(screen.getByText("14 paket")).toBeVisible();
  });

  it("puts the title in the bar and offers a labelled back link on detail screens", () => {
    render(<AppHeader title="INV-1038" back={{ href: "/packages" }} />);
    expect(screen.getByRole("heading", { level: 1, name: "INV-1038" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Geri" })).toHaveAttribute("href", "/packages");
  });

  it("shows a detail subtitle under the compact title", () => {
    render(<AppHeader title="INV-1042" subtitle="B Mağazalar Şəbəkəsi" back={{ href: "/" }} />);
    expect(screen.getByRole("heading", { level: 1, name: "INV-1042" })).toBeVisible();
    expect(screen.getByText("B Mağazalar Şəbəkəsi")).toBeVisible();
  });

  it("starts with a transparent bar", () => {
    render(<AppHeader large title="Əsas" />);
    expect(screen.getByRole("banner").style.getPropertyValue("--p")).toBe("0");
  });

  it("says when it is showing saved data because the device is offline", () => {
    render(<AppHeader title="Paketlər" />);
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => void window.dispatchEvent(new Event("offline")));
    expect(status).toHaveTextContent("Oflayn — son yüklənən məlumat göstərilir");
    online.mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event("online")));
    expect(status).toBeEmptyDOMElement();
    online.mockRestore();
  });
});
